"""Persistence and coordinate handling for locations.

Coordinates live in a PostGIS ``GEOGRAPHY(Point, 4326)`` column. We write them as
WKT (``POINT(lng lat)`` — x then y) and read them back with ``ST_X``/``ST_Y`` so
the rest of the app only ever deals in plain ``lat``/``lng`` floats.
"""

from __future__ import annotations

import uuid

from geoalchemy2 import Geometry
from geoalchemy2.elements import WKTElement
from sqlalchemy import Row, Select, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.location import Location
from app.schemas.location import LocationCreate, LocationRead, LocationUpdate
from app.services.geocode import GeocodeError, GeocodeService


def _point(lat: float, lng: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


def _base_select() -> Select[tuple[object, ...]]:
    # ST_X/ST_Y are geometry functions; cast the geography column before extracting.
    point = cast(Location.coordinates, Geometry())
    return select(
        Location.id,
        Location.name,
        Location.country_code,
        Location.created_at,
        Location.updated_at,
        func.ST_Y(point).label("lat"),
        func.ST_X(point).label("lng"),
    )


def _to_read(row: Row[tuple[object, ...]]) -> LocationRead:
    return LocationRead(
        id=row.id,
        name=row.name,
        lat=row.lat,
        lng=row.lng,
        country_code=row.country_code,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _read(db: AsyncSession, location_id: uuid.UUID) -> LocationRead | None:
    row = (await db.execute(_base_select().where(Location.id == location_id))).first()
    return _to_read(row) if row is not None else None


async def _derive_country(geocode: GeocodeService, lat: float, lng: float) -> str | None:
    """Reverse-geocode coordinates to an ISO country code; ``None`` if unavailable."""
    try:
        return (await geocode.reverse(lat, lng)).country_code
    except GeocodeError:
        return None


async def list_locations(db: AsyncSession) -> list[LocationRead]:
    rows = (await db.execute(_base_select().order_by(Location.created_at))).all()
    return [_to_read(row) for row in rows]


async def get_location(db: AsyncSession, location_id: uuid.UUID) -> LocationRead | None:
    return await _read(db, location_id)


async def create_location(
    db: AsyncSession, geocode: GeocodeService, data: LocationCreate
) -> LocationRead:
    country_code = data.country_code or await _derive_country(geocode, data.lat, data.lng)
    location = Location(
        name=data.name,
        coordinates=_point(data.lat, data.lng),
        country_code=country_code,
    )
    db.add(location)
    await db.commit()
    created = await _read(db, location.id)
    assert created is not None  # row was just inserted in this transaction
    return created


async def update_location(
    db: AsyncSession, geocode: GeocodeService, location_id: uuid.UUID, data: LocationUpdate
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
    return await _read(db, location_id)


async def delete_location(db: AsyncSession, location_id: uuid.UUID) -> bool:
    """Hard-delete a location. ``user_location_states`` and ``album_locations``
    rows cascade via their ``ON DELETE CASCADE`` foreign keys."""
    location = await db.get(Location, location_id)
    if location is None:
        return False
    await db.delete(location)
    await db.commit()
    return True
