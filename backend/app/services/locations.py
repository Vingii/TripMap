"""Persistence and coordinate handling for locations.

Coordinates live in a PostGIS ``GEOGRAPHY(Point, 4326)`` column. We write them as
WKT (``POINT(lng lat)`` — x then y) and read them back with ``ST_X``/``ST_Y`` so
the rest of the app only ever deals in plain ``lat``/``lng`` floats.

Locations are shared across all users; the only per-user facet is ``visited``,
derived from the requesting user's row in ``user_location_states``.
"""

from __future__ import annotations

import uuid

from geoalchemy2 import Geometry
from geoalchemy2.elements import WKTElement
from sqlalchemy import Row, Select, cast, delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.location import Location
from app.models.user_location_state import LocationStatus, UserLocationState
from app.schemas.location import LocationCreate, LocationRead, LocationUpdate
from app.services.geocode import GeocodeError, GeocodeService


def _point(lat: float, lng: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


def _base_select(user_id: uuid.UUID) -> Select[tuple[object, ...]]:
    # ST_X/ST_Y are geometry functions; cast the geography column before extracting.
    point = cast(Location.coordinates, Geometry())
    visited = (
        select(UserLocationState.location_id)
        .where(
            UserLocationState.location_id == Location.id,
            UserLocationState.user_id == user_id,
            UserLocationState.status == LocationStatus.visited,
        )
        .exists()
        .label("visited")
    )
    return select(
        Location.id,
        Location.name,
        Location.country_code,
        Location.created_at,
        Location.updated_at,
        func.ST_Y(point).label("lat"),
        func.ST_X(point).label("lng"),
        visited,
    )


def _to_read(row: Row[tuple[object, ...]]) -> LocationRead:
    return LocationRead(
        id=row.id,
        name=row.name,
        lat=row.lat,
        lng=row.lng,
        country_code=row.country_code,
        visited=row.visited,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _read(
    db: AsyncSession, user_id: uuid.UUID, location_id: uuid.UUID
) -> LocationRead | None:
    row = (await db.execute(_base_select(user_id).where(Location.id == location_id))).first()
    return _to_read(row) if row is not None else None


async def _derive_country(geocode: GeocodeService, lat: float, lng: float) -> str | None:
    """Reverse-geocode coordinates to an ISO country code; ``None`` if unavailable."""
    try:
        return (await geocode.reverse(lat, lng)).country_code
    except GeocodeError:
        return None


async def list_locations(db: AsyncSession, user_id: uuid.UUID) -> list[LocationRead]:
    rows = (await db.execute(_base_select(user_id).order_by(Location.created_at))).all()
    return [_to_read(row) for row in rows]


async def get_location(
    db: AsyncSession, user_id: uuid.UUID, location_id: uuid.UUID
) -> LocationRead | None:
    return await _read(db, user_id, location_id)


async def create_location(
    db: AsyncSession, geocode: GeocodeService, user_id: uuid.UUID, data: LocationCreate
) -> LocationRead:
    country_code = data.country_code or await _derive_country(geocode, data.lat, data.lng)
    location = Location(
        name=data.name,
        coordinates=_point(data.lat, data.lng),
        country_code=country_code,
    )
    db.add(location)
    await db.commit()
    created = await _read(db, user_id, location.id)
    assert created is not None  # row was just inserted in this transaction
    return created


async def update_location(
    db: AsyncSession,
    geocode: GeocodeService,
    user_id: uuid.UUID,
    location_id: uuid.UUID,
    data: LocationUpdate,
) -> LocationRead | None:
    location = await db.get(Location, location_id)
    if location is None:
        return None

    if data.name is not None:
        location.name = data.name
    if data.lat is not None and data.lng is not None:
        # PostGIS accepts WKT on write; the column is modelled as ``str`` for reads.
        location.coordinates = _point(data.lat, data.lng)  # type: ignore[assignment]
        # Coordinates moved — re-derive the country unless the caller supplied one.
        location.country_code = data.country_code or await _derive_country(
            geocode, data.lat, data.lng
        )
    elif data.country_code is not None:
        location.country_code = data.country_code

    await db.commit()
    return await _read(db, user_id, location_id)


async def set_visited(
    db: AsyncSession, user_id: uuid.UUID, location_id: uuid.UUID, visited: bool
) -> LocationRead | None:
    """Upsert (or clear) the requesting user's ``visited`` state for a location.

    Marking visited upserts a ``visited`` row; unmarking removes the user's row
    entirely. Returns ``None`` if the location does not exist.
    """
    if await db.get(Location, location_id) is None:
        return None

    if visited:
        stmt = (
            pg_insert(UserLocationState)
            .values(
                user_id=user_id,
                location_id=location_id,
                status=LocationStatus.visited,
                visited_at=func.now(),
            )
            .on_conflict_do_update(
                index_elements=["user_id", "location_id"],
                set_={"status": LocationStatus.visited},
            )
        )
        await db.execute(stmt)
    else:
        await db.execute(
            delete(UserLocationState).where(
                UserLocationState.user_id == user_id,
                UserLocationState.location_id == location_id,
            )
        )
    await db.commit()
    return await _read(db, user_id, location_id)


async def delete_location(db: AsyncSession, location_id: uuid.UUID) -> bool:
    """Hard-delete a location. ``user_location_states`` and ``album_locations``
    rows cascade via their ``ON DELETE CASCADE`` foreign keys."""
    location = await db.get(Location, location_id)
    if location is None:
        return False
    await db.delete(location)
    await db.commit()
    return True
