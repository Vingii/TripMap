import json
from collections.abc import Callable

import httpx
import pytest

from app.config import Settings
from app.services.feedback import (
    Attachment,
    FeedbackAttachmentError,
    FeedbackError,
    FeedbackNotConfiguredError,
    FeedbackService,
    create_feedback_service,
)

ISSUE_ID = "2-123"

Handler = Callable[[httpx.Request], httpx.Response]


def _service(handler: Handler) -> FeedbackService:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://youtrack.test"
    )
    return FeedbackService(client, "TM")


def _created(_request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json={"id": ISSUE_ID, "idReadable": "TM-42"})


async def test_submit_creates_request_issue_with_sponsor() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return _created(request)

    issue = await _service(handler).submit("The map is slow", reporter="Jane Doe")

    assert issue == "TM-42"
    assert len(requests) == 1
    request = requests[0]
    assert request.method == "POST"
    assert request.url.path == "/api/issues"
    body = json.loads(request.content)
    assert body["summary"] == "New Feedback Request"
    assert body["description"] == "The map is slow"
    assert body["project"] == {"shortName": "TM"}
    fields = {field["name"]: field for field in body["customFields"]}
    assert fields["Type"]["value"] == {"name": "Request"}
    assert fields["Type"]["$type"] == "SingleEnumIssueCustomField"
    assert fields["Sponsor"]["value"] == "Jane Doe"
    assert fields["Sponsor"]["$type"] == "SimpleIssueCustomField"


async def test_submit_uploads_attachment_to_created_issue() -> None:
    uploads: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/issues":
            return _created(request)
        uploads.append(request)
        return httpx.Response(200, json=[{"id": "att-1"}])

    await _service(handler).submit(
        "See screenshot",
        reporter="Jane",
        attachment=Attachment("shot.png", b"\x89PNG-bytes", "image/png"),
    )

    assert len(uploads) == 1
    upload = uploads[0]
    # Attachments go to the internal ID, not the readable one.
    assert upload.url.path == f"/api/issues/{ISSUE_ID}/attachments"
    assert upload.headers["content-type"].startswith("multipart/form-data")
    content = upload.read()
    assert b'name="files"; filename="shot.png"' in content
    assert b"Content-Type: image/png" in content
    assert b"\x89PNG-bytes" in content


async def test_readable_id_falls_back_to_internal_id() -> None:
    issue = await _service(lambda _r: httpx.Response(200, json={"id": ISSUE_ID})).submit(
        "hi", reporter="Jane"
    )

    assert issue == ISSUE_ID


async def test_unconfigured_service_refuses() -> None:
    with pytest.raises(FeedbackNotConfiguredError):
        await FeedbackService(None, "").submit("hi", reporter="Jane")


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(400, json={"error": "bad"}),
        httpx.Response(500, text="boom"),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"unexpected": True}),
    ],
)
async def test_issue_creation_failures_raise(response: httpx.Response) -> None:
    with pytest.raises(FeedbackError) as caught:
        await _service(lambda _r: response).submit("hi", reporter="Jane")

    assert caught.value.status_code == 502


async def test_unreachable_youtrack_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(FeedbackError, match="unreachable"):
        await _service(handler).submit("hi", reporter="Jane")


async def test_attachment_failure_raises_after_issue_was_created() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/issues":
            return _created(request)
        return httpx.Response(413)

    with pytest.raises(FeedbackAttachmentError):
        await _service(handler).submit(
            "hi", reporter="Jane", attachment=Attachment("a.txt", b"x", "text/plain")
        )


async def test_factory_requires_every_youtrack_setting() -> None:
    complete = create_feedback_service(
        Settings(
            youtrack_base_url="https://youtrack.example/",
            youtrack_api_token="perm:token",
            youtrack_project_id="TM",
        )
    )
    partial = create_feedback_service(Settings(youtrack_base_url="https://youtrack.example"))
    try:
        assert complete.configured
        assert not partial.configured
    finally:
        await complete.aclose()
