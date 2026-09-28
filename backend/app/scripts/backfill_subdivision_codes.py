"""Fill in ``subdivision_code`` for locations created before the column existed.

The value comes from Nominatim, so a migration cannot produce it. Run this once
after upgrading::

    make backfill-subdivisions

Every candidate costs one reverse-geocode call, serialised by the geocoder's
rate limiter (~1 req/s against the public Nominatim instance), so a large
database takes a while. The command is safe to re-run and to interrupt: it only
considers rows that are still missing a code, and commits as it goes. Locations
that genuinely have no subdivision — open ocean, city-states — stay ``NULL`` and
are retried on every run.
"""

from __future__ import annotations

import asyncio

from geoalchemy2 import Geometry
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import async_session_factory
from app.models.location import Location
from app.services.geocode import GeocodeError, GeocodeService, create_geocode_service


async def backfill(db: AsyncSession, geocode: GeocodeService) -> tuple[int, int]:
    """Resolve and store the region of every location missing a subdivision.

    Returns ``(updated, examined)``.
    """
    point = cast(Location.coordinates, Geometry())
    rows = (
        await db.execute(
            select(
                Location.id,
                Location.name,
                func.ST_Y(point).label("lat"),
                func.ST_X(point).label("lng"),
            )
            .where(Location.subdivision_code.is_(None))
            .order_by(Location.created_at)
        )
    ).all()

    print(f"{len(rows)} location(s) without a subdivision code")
    updated = 0
    for row in rows:
        try:
            result = await geocode.reverse(row.lat, row.lng)
        except GeocodeError as exc:
            print(f"  {row.name}: geocoding failed ({exc})")
            continue

        if result.subdivision_code is None:
            print(f"  {row.name}: no subdivision reported")
            continue

        location = await db.get(Location, row.id)
        if location is None:  # deleted while we were geocoding
            continue
        location.subdivision_code = result.subdivision_code
        # Older rows may predate country_code too; fill it from the same call.
        location.country_code = location.country_code or result.country_code
        await db.commit()
        updated += 1
        print(f"  {row.name}: {result.subdivision_code}")

    return updated, len(rows)


async def main() -> None:
    geocode = create_geocode_service(get_settings())
    try:
        async with async_session_factory() as db:
            updated, examined = await backfill(db, geocode)
    finally:
        await geocode.aclose()
    print(f"Updated {updated} of {examined} location(s)")


if __name__ == "__main__":
    asyncio.run(main())
