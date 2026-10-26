from pydantic import BaseModel


class FeedbackRead(BaseModel):
    """The YouTrack issue a feedback message was filed as."""

    # Readable issue ID, e.g. ``TM-42``.
    issue_id: str
