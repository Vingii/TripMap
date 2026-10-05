"""Persistence for albums and their location membership.

Albums belong to the user who created them and are only visible to that user;
the locations inside them are the shared, global locations. Membership lives in
``album_locations``, so removing a location from an album — or deleting the
album — never deletes the location itself.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Row, Select, delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.album import Album
from app.models.album_location import AlbumLocation
from app.models.location import Location
from app.schemas.album import AlbumCreate, AlbumDetail, AlbumRead, AlbumUpdate
from app.services.locations import list_album_locations


class LocationNotFoundError(Exception):
    """The location being added to an album does not exist."""


def _counted_select(owner_id: uuid.UUID) -> Select[tuple[Album, int]]:
    location_count = func.count(AlbumLocation.location_id).label("location_count")
    return (
        select(Album, location_count)
        .outerjoin(AlbumLocation, AlbumLocation.album_id == Album.id)
        .where(Album.owner_id == owner_id)
        .group_by(Album.id)
    )


def _to_read(row: Row[tuple[Album, int]]) -> AlbumRead:
    album, location_count = row
    return AlbumRead(
        id=album.id,
        name=album.name,
        description=album.description,
        date=album.date,
        date_precision=album.date_precision,
        immich_album_id=album.immich_album_id,
        cover_asset_id=album.cover_asset_id,
        location_count=location_count,
        created_at=album.created_at,
        updated_at=album.updated_at,
    )


async def _owned(db: AsyncSession, owner_id: uuid.UUID, album_id: uuid.UUID) -> Album | None:
    album = await db.get(Album, album_id)
    return album if album is not None and album.owner_id == owner_id else None


async def list_albums(db: AsyncSession, owner_id: uuid.UUID) -> list[AlbumRead]:
    """The user's albums, most recent first."""
    stmt = _counted_select(owner_id).order_by(Album.date.desc(), Album.created_at.desc())
    return [_to_read(row) for row in (await db.execute(stmt)).all()]


async def get_album(
    db: AsyncSession, owner_id: uuid.UUID, album_id: uuid.UUID
) -> AlbumDetail | None:
    row = (await db.execute(_counted_select(owner_id).where(Album.id == album_id))).first()
    if row is None:
        return None
    locations = await list_album_locations(db, owner_id, album_id)
    return AlbumDetail(**_to_read(row).model_dump(), locations=locations)


async def get_immich_link(
    db: AsyncSession, owner_id: uuid.UUID, album_id: uuid.UUID
) -> tuple[str | None, str | None] | None:
    """The album's ``(immich_album_id, cover_asset_id)``, or ``None`` if it does not exist."""
    album = await _owned(db, owner_id, album_id)
    return None if album is None else (album.immich_album_id, album.cover_asset_id)


async def create_album(db: AsyncSession, owner_id: uuid.UUID, data: AlbumCreate) -> AlbumDetail:
    album = Album(owner_id=owner_id, **data.model_dump())
    db.add(album)
    await db.commit()
    created = await get_album(db, owner_id, album.id)
    assert created is not None  # row was just inserted in this transaction
    return created


async def update_album(
    db: AsyncSession, owner_id: uuid.UUID, album_id: uuid.UUID, data: AlbumUpdate
) -> AlbumDetail | None:
    album = await _owned(db, owner_id, album_id)
    if album is None:
        return None

    changes = data.model_dump(exclude_unset=True)
    # Required columns ignore an explicit null; the nullable ones are cleared by it.
    for field in ("name", "date", "date_precision"):
        if changes.get(field, ...) is None:
            del changes[field]
    # A cover is an asset of the linked Immich album, so it cannot outlive the link.
    if "immich_album_id" in changes and changes["immich_album_id"] != album.immich_album_id:
        changes.setdefault("cover_asset_id", None)
    if changes.get("immich_album_id", album.immich_album_id) is None:
        changes["cover_asset_id"] = None
    for field, value in changes.items():
        setattr(album, field, value)

    await db.commit()
    return await get_album(db, owner_id, album_id)


async def delete_album(db: AsyncSession, owner_id: uuid.UUID, album_id: uuid.UUID) -> bool:
    """Delete an album. Its ``album_locations`` rows cascade; the locations stay."""
    album = await _owned(db, owner_id, album_id)
    if album is None:
        return False
    await db.delete(album)
    await db.commit()
    return True


async def add_location(
    db: AsyncSession, owner_id: uuid.UUID, album_id: uuid.UUID, location_id: uuid.UUID
) -> AlbumDetail | None:
    """Add a location to an album; adding one that is already there is a no-op.

    Returns ``None`` if the album does not exist and raises
    ``LocationNotFoundError`` if the location does not.
    """
    if await _owned(db, owner_id, album_id) is None:
        return None
    if await db.get(Location, location_id) is None:
        raise LocationNotFoundError

    await db.execute(
        pg_insert(AlbumLocation)
        .values(album_id=album_id, location_id=location_id)
        .on_conflict_do_nothing(index_elements=["album_id", "location_id"])
    )
    await db.commit()
    return await get_album(db, owner_id, album_id)


async def remove_location(
    db: AsyncSession, owner_id: uuid.UUID, album_id: uuid.UUID, location_id: uuid.UUID
) -> bool | None:
    """Remove a location from an album.

    Returns ``None`` if the album does not exist and ``False`` if the location
    was not in it.
    """
    if await _owned(db, owner_id, album_id) is None:
        return None
    result = await db.execute(
        delete(AlbumLocation).where(
            AlbumLocation.album_id == album_id, AlbumLocation.location_id == location_id
        )
    )
    await db.commit()
    return bool(result.rowcount)  # type: ignore[attr-defined]
