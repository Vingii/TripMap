"""Filing user feedback as YouTrack issues.

Feedback is not stored locally: each message becomes a "Request" issue in the
configured YouTrack project, created with an instance-wide service token. The
submitting user is recorded in the issue's "Sponsor" field, and an optional
attachment is uploaded to the issue once it exists.

Failures are raised as :class:`FeedbackError` subclasses carrying the HTTP
status the API answers with — never 401, which the SPA reads as an expired
TripMap session.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import Settings

ISSUE_SUMMARY = "New Feedback Request"
ISSUE_TYPE = "Request"
SPONSOR_FIELD = "Sponsor"


class FeedbackError(Exception):
    status_code = 502
    detail = "Feedback could not be sent"

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.detail)
        if detail:
            self.detail = detail


class FeedbackNotConfiguredError(FeedbackError):
    status_code = 503
    detail = "Feedback is not configured on this server"


class FeedbackAttachmentError(FeedbackError):
    status_code = 502
    detail = "Your feedback was sent, but the attachment could not be uploaded"


@dataclass(frozen=True)
class Attachment:
    filename: str
    content: bytes
    content_type: str


class FeedbackService:
    def __init__(self, client: httpx.AsyncClient | None, project_id: str) -> None:
        # ``None`` when YouTrack is not fully configured: every submission then
        # fails with FeedbackNotConfiguredError rather than reaching out anywhere.
        self._client = client
        self._project_id = project_id

    @property
    def configured(self) -> bool:
        return self._client is not None

    async def submit(
        self, message: str, reporter: str, attachment: Attachment | None = None
    ) -> str:
        """Create the issue (and upload ``attachment`` to it); returns its
        readable ID, e.g. ``TM-42``."""
        if self._client is None:
            raise FeedbackNotConfiguredError
        issue_id, readable_id = await self._create_issue(self._client, message, reporter)
        if attachment is not None:
            await self._attach(self._client, issue_id, attachment)
        return readable_id

    async def _create_issue(
        self, client: httpx.AsyncClient, message: str, reporter: str
    ) -> tuple[str, str]:
        """Returns the internal ID, which addresses the issue in later calls,
        and the readable one for display."""
        payload = {
            "summary": ISSUE_SUMMARY,
            "description": message,
            "project": {"shortName": self._project_id},
            "customFields": [
                {
                    "name": "Type",
                    "$type": "SingleEnumIssueCustomField",
                    "value": {"name": ISSUE_TYPE},
                },
                {"name": SPONSOR_FIELD, "$type": "SimpleIssueCustomField", "value": reporter},
            ],
        }
        try:
            response = await client.post(
                "/api/issues", params={"fields": "id,idReadable"}, json=payload
            )
        except httpx.HTTPError as exc:
            raise FeedbackError("YouTrack is unreachable") from exc
        if response.is_error:
            raise FeedbackError(f"YouTrack returned HTTP {response.status_code}")
        try:
            body = response.json()
        except ValueError as exc:
            raise FeedbackError("Unexpected response from YouTrack") from exc
        issue_id = body.get("id") if isinstance(body, dict) else None
        if not isinstance(issue_id, str) or not issue_id:
            raise FeedbackError("Unexpected response from YouTrack")
        readable = body.get("idReadable")
        return issue_id, readable if isinstance(readable, str) and readable else issue_id

    async def _attach(
        self, client: httpx.AsyncClient, issue_id: str, attachment: Attachment
    ) -> None:
        files = {"files": (attachment.filename, attachment.content, attachment.content_type)}
        try:
            response = await client.post(
                f"/api/issues/{issue_id}/attachments", params={"fields": "id"}, files=files
            )
        except httpx.HTTPError as exc:
            raise FeedbackAttachmentError from exc
        if response.is_error:
            raise FeedbackAttachmentError

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()


def create_feedback_service(settings: Settings) -> FeedbackService:
    if not settings.feedback_configured:
        return FeedbackService(None, "")
    client = httpx.AsyncClient(
        base_url=settings.youtrack_base_url.rstrip("/"),
        timeout=settings.youtrack_timeout_seconds,
        headers={
            "Authorization": f"Bearer {settings.youtrack_api_token}",
            "Accept": "application/json",
        },
    )
    return FeedbackService(client, settings.youtrack_project_id)
