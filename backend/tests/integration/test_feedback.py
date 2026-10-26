"""End-to-end tests for the feedback endpoint.

YouTrack is replaced by an ``httpx.MockTransport`` that records what it is
sent, so the tests exercise the real route, auth and form parsing without a
network.
"""

import json
from collections.abc import Iterator

import httpx
import pytest
from httpx import AsyncClient

from app.config import Settings, get_settings
from app.deps import get_feedback_service
from app.main import app
from app.services.feedback import FeedbackService

pytestmark = pytest.mark.usefixtures("client")

ISSUE_ID = "2-77"


class FakeYouTrack:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.fail_attachments = False

    def __call__(self, request: httpx.Request) -> httpx.Response:
        request.read()
        self.requests.append(request)
        if request.url.path == "/api/issues":
            return httpx.Response(200, json={"id": ISSUE_ID, "idReadable": "TM-77"})
        if self.fail_attachments:
            return httpx.Response(500)
        return httpx.Response(200, json=[{"id": "att"}])


@pytest.fixture
def youtrack() -> Iterator[FakeYouTrack]:
    fake = FakeYouTrack()
    http = httpx.AsyncClient(transport=httpx.MockTransport(fake), base_url="https://yt.test")
    service = FeedbackService(http, "TM")
    app.dependency_overrides[get_feedback_service] = lambda: service
    yield fake
    app.dependency_overrides.pop(get_feedback_service, None)


async def test_feedback_creates_issue_named_after_user(
    client: AsyncClient, youtrack: FakeYouTrack
) -> None:
    response = await client.post("/api/feedback", data={"message": "  Love it  "})

    assert response.status_code == 201, response.text
    assert response.json() == {"issue_id": "TM-77"}
    assert len(youtrack.requests) == 1
    body = json.loads(youtrack.requests[0].content)
    assert body["description"] == "Love it"
    sponsor = next(f for f in body["customFields"] if f["name"] == "Sponsor")
    assert sponsor["value"] == "Tester"


async def test_feedback_forwards_attachment(client: AsyncClient, youtrack: FakeYouTrack) -> None:
    response = await client.post(
        "/api/feedback",
        data={"message": "Broken pin"},
        files={"attachment": ("pin.png", b"png-bytes", "image/png")},
    )

    assert response.status_code == 201, response.text
    upload = youtrack.requests[1]
    assert upload.url.path == f"/api/issues/{ISSUE_ID}/attachments"
    assert b'filename="pin.png"' in upload.content
    assert b"png-bytes" in upload.content


async def test_feedback_rejects_blank_message(client: AsyncClient, youtrack: FakeYouTrack) -> None:
    response = await client.post("/api/feedback", data={"message": "   "})

    assert response.status_code == 422
    assert youtrack.requests == []


async def test_feedback_rejects_oversized_attachment(
    client: AsyncClient, youtrack: FakeYouTrack
) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(feedback_max_attachment_bytes=4)
    try:
        response = await client.post(
            "/api/feedback",
            data={"message": "hi"},
            files={"attachment": ("big.bin", b"12345", "application/octet-stream")},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 413
    assert youtrack.requests == []


async def test_feedback_reports_failed_attachment(
    client: AsyncClient, youtrack: FakeYouTrack
) -> None:
    youtrack.fail_attachments = True

    response = await client.post(
        "/api/feedback",
        data={"message": "hi"},
        files={"attachment": ("a.txt", b"x", "text/plain")},
    )

    assert response.status_code == 502
    assert "attachment" in response.json()["detail"]


async def test_feedback_unconfigured_is_503(client: AsyncClient) -> None:
    app.dependency_overrides[get_feedback_service] = lambda: FeedbackService(None, "")
    try:
        response = await client.post("/api/feedback", data={"message": "hi"})
    finally:
        app.dependency_overrides.pop(get_feedback_service, None)

    assert response.status_code == 503
    assert response.json() == {"detail": "Feedback is not configured on this server"}


@pytest.mark.noauth
async def test_feedback_requires_auth(client: AsyncClient) -> None:
    response = await client.post("/api/feedback", data={"message": "hi"})

    assert response.status_code == 401
