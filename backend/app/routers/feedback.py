"""In-app feedback, filed straight into YouTrack.

YouTrack failures surface as :class:`~app.services.feedback.FeedbackError`,
which the app-wide exception handler turns into ``{"detail": …}``.
"""

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.deps import CurrentUserDep, FeedbackServiceDep, SettingsDep
from app.schemas.feedback import FeedbackRead
from app.services.feedback import Attachment

router = APIRouter(prefix="/feedback", tags=["feedback"])

MAX_MESSAGE_LENGTH = 10_000


@router.post("", response_model=FeedbackRead, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    user: CurrentUserDep,
    feedback: FeedbackServiceDep,
    settings: SettingsDep,
    message: Annotated[str, Form(max_length=MAX_MESSAGE_LENGTH)],
    attachment: Annotated[UploadFile | None, File()] = None,
) -> FeedbackRead:
    text = message.strip()
    if not text:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Message must not be empty")
    issue_id = await feedback.submit(
        text,
        reporter=user.display_name or user.email,
        attachment=await _read_attachment(attachment, settings.feedback_max_attachment_bytes),
    )
    return FeedbackRead(issue_id=issue_id)


async def _read_attachment(upload: UploadFile | None, limit: int) -> Attachment | None:
    # Browsers send an empty, unnamed part for a file input left blank.
    if upload is None or not upload.filename:
        return None
    # Read one byte past the limit so an oversized file is caught without
    # loading all of it.
    content = await upload.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Attachment exceeds {limit // (1024 * 1024)} MB",
        )
    return Attachment(
        filename=upload.filename,
        content=content,
        content_type=upload.content_type or "application/octet-stream",
    )
