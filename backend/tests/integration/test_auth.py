"""Authentication enforcement on protected endpoints.

These tests run with ``@pytest.mark.noauth`` so the real ``get_current_user``
dependency is exercised rather than the test override.
"""

import pytest
from httpx import AsyncClient

pytestmark = [pytest.mark.usefixtures("client"), pytest.mark.noauth]


async def test_locations_require_authentication(client: AsyncClient) -> None:
    response = await client.get("/api/locations")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


async def test_me_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get("/api/me")).status_code == 401


async def test_geocode_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get("/api/geocode/search?q=paris")).status_code == 401


async def test_invalid_token_is_rejected(client: AsyncClient) -> None:
    # The verifier is unconfigured in tests, so any presented token fails to verify.
    response = await client.get(
        "/api/locations", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


async def test_health_is_public(client: AsyncClient) -> None:
    assert (await client.get("/api/health")).status_code == 200
