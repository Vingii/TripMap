"""Shared fixtures for DB-backed integration tests.

Tests that request the ``client`` / ``db_session`` fixtures run against a real
PostgreSQL+PostGIS instance pointed at by ``TEST_DATABASE_URL``; when that variable
is unset (e.g. a bare ``pytest`` run with no database) those tests skip rather than
fail. Migrations are applied once per session; each test starts from a truncated
schema so cases stay independent.
"""

import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from alembic import command
from alembic.config import Config
from app.config import get_settings
from app.db import get_session
from app.main import app

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Child-to-parent order so cascading truncation never trips a foreign key.
_TABLES = (
    "user_location_states",
    "album_locations",
    "album_members",
    "albums",
    "locations",
    "users",
)


def _test_database_url() -> str:
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is not set; skipping DB-backed integration test")
    return url


@pytest.fixture(scope="session")
def _migrated_database() -> str:
    url = _test_database_url()
    # alembic env.py reads the URL from app settings — point both at the test DB.
    os.environ["DATABASE_URL"] = url
    get_settings.cache_clear()

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")
    return url


@pytest.fixture
async def db_engine(_migrated_database: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(_migrated_database)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)

    async with factory() as cleanup:
        await cleanup.execute(text(f"TRUNCATE {', '.join(_TABLES)} RESTART IDENTITY CASCADE"))
        await cleanup.commit()

    async def _override() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = _override
    async with factory() as session:
        yield session
    app.dependency_overrides.pop(get_session, None)


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
