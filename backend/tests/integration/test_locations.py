"""End-to-end CRUD tests for the locations API against a real PostgreSQL+PostGIS DB.

Nominatim is stubbed so coordinate-derived country codes are deterministic and no
network calls leave the test.
"""

from collections.abc import Iterator

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_geocode_service
from app.main import app
from app.models.user import User
from app.services.geocode import GeocodeService, _RateLimiter
from tests.integration.conftest import Login

pytestmark = pytest.mark.usefixtures("client")


def _stub_geocode(country_code: str | None) -> GeocodeService:
    def handler(request: httpx.Request) -> httpx.Response:
        address = {"country_code": country_code} if country_code else {}
        return httpx.Response(200, json={"address": address})

    transport = httpx.MockTransport(handler)
    http = httpx.AsyncClient(transport=transport, base_url="https://nominatim.test")
    return GeocodeService(http, search_limit=10, rate_limiter=_RateLimiter(0.0))


@pytest.fixture(autouse=True)
def _reverse_geocodes_to_france() -> Iterator[None]:
    """Default: any reverse-geocode lookup resolves to FR unless a test overrides it."""
    app.dependency_overrides[get_geocode_service] = lambda: _stub_geocode("FR")
    yield
    app.dependency_overrides.pop(get_geocode_service, None)


async def test_create_keeps_explicit_country_code(client: AsyncClient) -> None:
    response = await client.post(
        "/api/locations",
        json={"name": "Berlin", "lat": 52.52, "lng": 13.405, "country_code": "DE"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Berlin"
    assert body["lat"] == pytest.approx(52.52)
    assert body["lng"] == pytest.approx(13.405)
    assert body["country_code"] == "DE"
    assert body["visited"] is False
    assert "id" in body and "created_at" in body


async def test_create_derives_country_code_from_coordinates(client: AsyncClient) -> None:
    response = await client.post(
        "/api/locations",
        json={"name": "Somewhere", "lat": 48.85, "lng": 2.35},
    )

    assert response.status_code == 201
    assert response.json()["country_code"] == "FR"


async def test_create_rejects_out_of_range_coordinates(client: AsyncClient) -> None:
    response = await client.post(
        "/api/locations",
        json={"name": "Nowhere", "lat": 999, "lng": 0},
    )

    assert response.status_code == 422


async def test_list_returns_created_locations(client: AsyncClient) -> None:
    await client.post("/api/locations", json={"name": "A", "lat": 1, "lng": 2})
    await client.post("/api/locations", json={"name": "B", "lat": 3, "lng": 4})

    response = await client.get("/api/locations")

    assert response.status_code == 200
    names = [item["name"] for item in response.json()]
    assert names == ["A", "B"]
    assert all(item["visited"] is False for item in response.json())


async def test_get_returns_single_location(client: AsyncClient) -> None:
    created = (
        await client.post("/api/locations", json={"name": "Rome", "lat": 41.9, "lng": 12.5})
    ).json()

    response = await client.get(f"/api/locations/{created['id']}")

    assert response.status_code == 200
    assert response.json()["name"] == "Rome"


async def test_get_unknown_location_is_404(client: AsyncClient) -> None:
    response = await client.get("/api/locations/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


async def test_update_renames_without_moving(client: AsyncClient) -> None:
    created = (
        await client.post(
            "/api/locations",
            json={"name": "Old", "lat": 10, "lng": 20, "country_code": "DE"},
        )
    ).json()

    response = await client.patch(f"/api/locations/{created['id']}", json={"name": "New"})

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "New"
    assert body["lat"] == pytest.approx(10)
    assert body["country_code"] == "DE"  # unchanged: coordinates did not move


async def test_update_coordinates_rederives_country(client: AsyncClient) -> None:
    created = (
        await client.post(
            "/api/locations",
            json={"name": "Place", "lat": 10, "lng": 20, "country_code": "DE"},
        )
    ).json()

    response = await client.patch(
        f"/api/locations/{created['id']}", json={"lat": 48.85, "lng": 2.35}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["lat"] == pytest.approx(48.85)
    assert body["country_code"] == "FR"  # re-derived from the stubbed reverse lookup


async def test_update_unknown_location_is_404(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/locations/00000000-0000-0000-0000-000000000000", json={"name": "x"}
    )
    assert response.status_code == 404


async def test_delete_removes_location(client: AsyncClient) -> None:
    created = (
        await client.post("/api/locations", json={"name": "Temp", "lat": 5, "lng": 6})
    ).json()

    delete_response = await client.delete(f"/api/locations/{created['id']}")
    assert delete_response.status_code == 204

    assert (await client.get(f"/api/locations/{created['id']}")).status_code == 404


async def test_delete_unknown_location_is_404(client: AsyncClient) -> None:
    response = await client.delete("/api/locations/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


async def test_set_visited_marks_and_unmarks(client: AsyncClient) -> None:
    created = (
        await client.post("/api/locations", json={"name": "Oslo", "lat": 59.9, "lng": 10.75})
    ).json()
    assert created["visited"] is False

    marked = await client.put(f"/api/locations/{created['id']}/visited", json={"visited": True})
    assert marked.status_code == 200
    assert marked.json()["visited"] is True
    # Reflected in subsequent reads.
    assert (await client.get(f"/api/locations/{created['id']}")).json()["visited"] is True

    unmarked = await client.put(f"/api/locations/{created['id']}/visited", json={"visited": False})
    assert unmarked.status_code == 200
    assert unmarked.json()["visited"] is False


async def test_set_visited_is_idempotent(client: AsyncClient) -> None:
    created = (
        await client.post("/api/locations", json={"name": "Bergen", "lat": 60.4, "lng": 5.3})
    ).json()

    first = await client.put(f"/api/locations/{created['id']}/visited", json={"visited": True})
    second = await client.put(f"/api/locations/{created['id']}/visited", json={"visited": True})

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["visited"] is True


async def test_set_visited_unknown_location_is_404(client: AsyncClient) -> None:
    response = await client.put(
        "/api/locations/00000000-0000-0000-0000-000000000000/visited",
        json={"visited": True},
    )
    assert response.status_code == 404


async def test_visited_is_scoped_per_user(
    client: AsyncClient, db_session: AsyncSession, authenticate: Login
) -> None:
    """One user marking a location visited must not affect another user's view."""
    created = (
        await client.post("/api/locations", json={"name": "Shared", "lat": 1, "lng": 2})
    ).json()
    await client.put(f"/api/locations/{created['id']}/visited", json={"visited": True})

    # A second user sees the same location but with their own (empty) visited state.
    other = User(oidc_sub="test|user-2", email="other@example.com", settings={})
    db_session.add(other)
    await db_session.commit()
    await db_session.refresh(other)
    authenticate(other)

    listed = (await client.get("/api/locations")).json()
    assert len(listed) == 1
    assert listed[0]["id"] == created["id"]
    assert listed[0]["visited"] is False
