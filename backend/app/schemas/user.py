import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

Theme = Literal["light", "dark", "system"]
Projection = Literal["flat", "globe"]
MapFilter = Literal["all", "visited"]


class UserSettings(BaseModel):
    """Per-user preferences as persisted in JSONB. Unknown keys are rejected so
    the stored shape never drifts from this model.

    ``immich_api_key`` is stored here but is a *write-only* secret: it is never
    surfaced verbatim by the API — see :class:`UserSettingsRead`.
    """

    model_config = ConfigDict(extra="forbid")

    theme: Theme = "system"
    default_projection: Projection = "flat"
    default_map_filter: MapFilter = "all"
    default_visited: bool = True
    immich_api_key: str | None = None

    @field_validator("immich_api_key")
    @classmethod
    def _blank_key_is_none(cls, value: str | None) -> str | None:
        """Treat an empty/whitespace key as "no key", so clearing it stores NULL."""
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class UserSettingsUpdate(BaseModel):
    """Partial settings update — only the supplied keys are changed.

    Send ``immich_api_key`` as ``""`` or ``null`` to clear a previously stored key.
    """

    model_config = ConfigDict(extra="forbid")

    theme: Theme | None = None
    default_projection: Projection | None = None
    default_map_filter: MapFilter | None = None
    default_visited: bool | None = None
    immich_api_key: str | None = None


class UserSettingsRead(BaseModel):
    """Settings as exposed by the API.

    The Immich API key is write-only: callers only ever learn whether one is set
    (``immich_api_key_set``), never its value.
    """

    theme: Theme
    default_projection: Projection
    default_map_filter: MapFilter
    default_visited: bool
    immich_api_key_set: bool

    @classmethod
    def from_settings(cls, settings: UserSettings) -> "UserSettingsRead":
        return cls(
            theme=settings.theme,
            default_projection=settings.default_projection,
            default_map_filter=settings.default_map_filter,
            default_visited=settings.default_visited,
            immich_api_key_set=bool(settings.immich_api_key),
        )


class UserRead(BaseModel):
    """The current user's profile, as returned by ``GET /api/me``."""

    id: uuid.UUID
    email: str
    display_name: str | None
    settings: UserSettingsRead
    created_at: datetime
    updated_at: datetime
