"""Seed the end-to-end test database.

Run by the ``e2e`` Docker Compose profile before the app starts, against a
throwaway database. Creates the fixed ``DEV_AUTH`` user and a few locations the
Playwright suite relies on, spread far enough apart that the map never clusters
them at the default world view. Regions are given explicitly so seeding never
calls Nominatim.

Skips everything when the database already has locations, so restarting the
container does not duplicate the data.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import async_session_factory
from app.deps import DEV_CLAIMS
from app.models.location import Location
from app.schemas.location import LocationCreate
from app.services import locations
from app.services.geocode import GeocodeService, create_geocode_service
from app.services.users import get_or_create_user

# (name, lat, lng, country, subdivisions, visited) — names are what the tests
# look for, see frontend/e2e/fixtures.ts.
SEED_LOCATIONS: list[tuple[str, float, float, str, list[str], bool]] = [
    ("E2E Paris", 48.8566, 2.3522, "FR", ["FR-IDF"], True),
    ("E2E Tokyo", 35.6762, 139.6503, "JP", ["JP-13"], False),
    ("E2E Buenos Aires", -34.6037, -58.3816, "AR", ["AR-C"], False),
]


async def seed(db: AsyncSession, geocode: GeocodeService) -> int:
    """Insert the seed data; returns how many locations were created."""
    if (await db.scalar(select(func.count()).select_from(Location))) != 0:
        return 0
    user = await get_or_create_user(db, DEV_CLAIMS)
    for name, lat, lng, country, subdivisions, visited in SEED_LOCATIONS:
        created = await locations.create_location(
            db,
            geocode,
            user.id,
            LocationCreate(
                name=name, lat=lat, lng=lng, country_code=country, subdivision_codes=subdivisions
            ),
        )
        if visited:
            await locations.set_visited(db, user.id, created.id, True)
    return len(SEED_LOCATIONS)


async def _main() -> None:
    geocode = create_geocode_service(get_settings())
    try:
        async with async_session_factory() as db:
            created = await seed(db, geocode)
    finally:
        await geocode.aclose()
    print(f"Seeded {created} e2e location(s)" if created else "E2E data already present")


if __name__ == "__main__":
    asyncio.run(_main())
