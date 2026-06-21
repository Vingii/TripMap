import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

Theme = Literal["light", "dark", "system"]
Projection = Literal["flat", "globe"]
MapFilter = Literal["all", "visited"]


class UserSettings(BaseModel):
    """Per-user preferences. Unknown keys are rejected so the stored JSONB never
    drifts from this shape."""

    model_config = ConfigDict(extra="forbid")

    theme: Theme = "system"
    default_projection: Projection = "flat"
    default_map_filter: MapFilter = "all"


class UserSettingsUpdate(BaseModel):
    """Partial settings update — only the supplied keys are changed."""

    model_config = ConfigDict(extra="forbid")

    theme: Theme | None = None
    default_projection: Projection | None = None
    default_map_filter: MapFilter | None = None


class UserRead(BaseModel):
    """The current user's profile, as returned by ``GET /api/me``."""

    id: uuid.UUID
    email: str
    display_name: str | None
    settings: UserSettings
    created_at: datetime
    updated_at: datetime
