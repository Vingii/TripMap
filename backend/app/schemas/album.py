import datetime as dt
import uuid

from pydantic import BaseModel, Field

from app.models.album import DatePrecision
from app.schemas.location import LocationRead


class AlbumCreate(BaseModel):
    """Payload for creating an album.

    ``date`` is always a full ISO date; ``date_precision`` says how much of it is
    meaningful (a "July 2024" album is sent as ``2024-07-01`` with ``month``).
    """

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    date: dt.date
    date_precision: DatePrecision = DatePrecision.day
    immich_album_id: str | None = Field(default=None, max_length=255)


class AlbumUpdate(BaseModel):
    """Partial update of an album.

    Only fields present in the payload change, so ``description``,
    ``immich_album_id`` and ``cover_asset_id`` are cleared by sending an explicit
    ``null``. Unlinking or relinking the Immich album also clears the cover,
    which belongs to the old album.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    date: dt.date | None = None
    date_precision: DatePrecision | None = None
    immich_album_id: str | None = Field(default=None, max_length=255)
    cover_asset_id: str | None = Field(default=None, max_length=255)


class AlbumLocationAdd(BaseModel):
    """Add an existing location to an album."""

    location_id: uuid.UUID


class AlbumRead(BaseModel):
    """An album as returned by the list endpoint."""

    id: uuid.UUID
    name: str
    description: str | None
    date: dt.date
    date_precision: DatePrecision
    immich_album_id: str | None
    cover_asset_id: str | None
    location_count: int
    created_at: dt.datetime
    updated_at: dt.datetime


class AlbumDetail(AlbumRead):
    """An album with its locations, in the order they were added."""

    locations: list[LocationRead]
