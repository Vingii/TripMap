"""End-to-end tests for the albums API against a real PostgreSQL+PostGIS DB.

Locations are created with an explicit ``country_code`` so no reverse-geocode
call is ever made; the geocoder is still stubbed because the locations route
resolves it regardless.
"""

from collections.abc import Iterator
from typing import Any

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

_MISSING = "00000000-0000-0000-0000-000000000000"


@pytest.fixture(autouse=True)
def _no_geocoding() -> Iterator[None]:
    """Fail loudly should any request reach Nominatim."""

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"unexpected geocode request: {request.url}")

    http = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://nominatim.test"
    )
    service = GeocodeService(http, search_limit=10, rate_limiter=_RateLimiter(0.0))
    app.dependency_overrides[get_geocode_service] = lambda: service
    yield
    app.dependency_overrides.pop(get_geocode_service, None)


async def _create_album(client: AsyncClient, **overrides: Any) -> dict[str, Any]:
    payload = {"name": "Summer trip", "date": "2024-07-14", **overrides}
    response = await client.post("/api/albums", json=payload)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def _create_location(client: AsyncClient, name: str = "Berlin") -> str:
    response = await client.post(
        "/api/locations",
        json={"name": name, "lat": 52.52, "lng": 13.405, "country_code": "DE"},
    )
    assert response.status_code == 201, response.text
    location_id: str = response.json()["id"]
    return location_id


async def test_create_returns_album_with_defaults(client: AsyncClient) -> None:
    body = await _create_album(client)

    assert body["name"] == "Summer trip"
    assert body["description"] is None
    assert body["date"] == "2024-07-14"
    assert body["date_precision"] == "day"
    assert body["immich_album_id"] is None
    assert body["location_count"] == 0
    assert body["locations"] == []
    assert "id" in body and "created_at" in body


async def test_create_keeps_all_fields(client: AsyncClient) -> None:
    body = await _create_album(
        client,
        description="Two weeks on the coast",
        date="2024-07-01",
        date_precision="month",
        immich_album_id="immich-123",
    )

    assert body["description"] == "Two weeks on the coast"
    assert body["date_precision"] == "month"
    assert body["immich_album_id"] == "immich-123"


@pytest.mark.parametrize(
    "payload",
    [
        {"date": "2024-07-14"},
        {"name": "", "date": "2024-07-14"},
        {"name": "No date"},
        {"name": "Bad precision", "date": "2024-07-14", "date_precision": "week"},
    ],
)
async def test_create_rejects_invalid_payload(client: AsyncClient, payload: dict[str, str]) -> None:
    response = await client.post("/api/albums", json=payload)

    assert response.status_code == 422


async def test_list_sorts_by_date_descending(client: AsyncClient) -> None:
    await _create_album(client, name="Old", date="2019-03-01")
    await _create_album(client, name="New", date="2025-01-10")
    await _create_album(client, name="Middle", date="2022-08-20")

    response = await client.get("/api/albums")

    assert response.status_code == 200
    assert [a["name"] for a in response.json()] == ["New", "Middle", "Old"]


async def test_list_includes_location_count(client: AsyncClient) -> None:
    album = await _create_album(client)
    for name in ("Berlin", "Munich"):
        location_id = await _create_location(client, name)
        await client.post(f"/api/albums/{album['id']}/locations", json={"location_id": location_id})
    await _create_album(client, name="Empty")

    response = await client.get("/api/albums")

    counts = {a["name"]: a["location_count"] for a in response.json()}
    assert counts == {"Summer trip": 2, "Empty": 0}
    assert "locations" not in response.json()[0]


async def test_get_returns_album_with_locations(client: AsyncClient) -> None:
    album = await _create_album(client)
    location_id = await _create_location(client)
    await client.post(f"/api/albums/{album['id']}/locations", json={"location_id": location_id})

    response = await client.get(f"/api/albums/{album['id']}")

    assert response.status_code == 200
    body = response.json()
    assert body["location_count"] == 1
    assert [loc["id"] for loc in body["locations"]] == [location_id]
    assert body["locations"][0]["lat"] == pytest.approx(52.52)


async def test_get_missing_album_is_404(client: AsyncClient) -> None:
    response = await client.get(f"/api/albums/{_MISSING}")

    assert response.status_code == 404


async def test_patch_updates_only_supplied_fields(client: AsyncClient) -> None:
    album = await _create_album(client, description="Keep me")

    response = await client.patch(
        f"/api/albums/{album['id']}", json={"name": "Renamed", "date_precision": "year"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Renamed"
    assert body["date_precision"] == "year"
    assert body["date"] == "2024-07-14"
    assert body["description"] == "Keep me"


async def test_patch_null_clears_optional_fields(client: AsyncClient) -> None:
    album = await _create_album(client, description="Drop me", immich_album_id="immich-1")

    response = await client.patch(
        f"/api/albums/{album['id']}",
        json={"description": None, "immich_album_id": None, "name": None},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["description"] is None
    assert body["immich_album_id"] is None
    assert body["name"] == "Summer trip"


async def test_patch_missing_album_is_404(client: AsyncClient) -> None:
    response = await client.patch(f"/api/albums/{_MISSING}", json={"name": "x"})

    assert response.status_code == 404


async def test_delete_album_keeps_its_locations(client: AsyncClient) -> None:
    album = await _create_album(client)
    location_id = await _create_location(client)
    await client.post(f"/api/albums/{album['id']}/locations", json={"location_id": location_id})

    response = await client.delete(f"/api/albums/{album['id']}")

    assert response.status_code == 204
    assert (await client.get(f"/api/albums/{album['id']}")).status_code == 404
    assert (await client.get(f"/api/locations/{location_id}")).status_code == 200


async def test_delete_missing_album_is_404(client: AsyncClient) -> None:
    response = await client.delete(f"/api/albums/{_MISSING}")

    assert response.status_code == 404


async def test_add_location_is_idempotent(client: AsyncClient) -> None:
    album = await _create_album(client)
    location_id = await _create_location(client)

    for _ in range(2):
        response = await client.post(
            f"/api/albums/{album['id']}/locations", json={"location_id": location_id}
        )
        assert response.status_code == 200
    assert response.json()["location_count"] == 1


async def test_location_can_belong_to_multiple_albums(client: AsyncClient) -> None:
    location_id = await _create_location(client)
    albums = [await _create_album(client, name=name) for name in ("A", "B")]

    for album in albums:
        await client.post(f"/api/albums/{album['id']}/locations", json={"location_id": location_id})

    for album in albums:
        body = (await client.get(f"/api/albums/{album['id']}")).json()
        assert [loc["id"] for loc in body["locations"]] == [location_id]


async def test_add_missing_location_is_404(client: AsyncClient) -> None:
    album = await _create_album(client)

    response = await client.post(
        f"/api/albums/{album['id']}/locations", json={"location_id": _MISSING}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Location not found"


async def test_add_location_to_missing_album_is_404(client: AsyncClient) -> None:
    location_id = await _create_location(client)

    response = await client.post(
        f"/api/albums/{_MISSING}/locations", json={"location_id": location_id}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Album not found"


async def test_remove_location_keeps_the_location(client: AsyncClient) -> None:
    album = await _create_album(client)
    location_id = await _create_location(client)
    await client.post(f"/api/albums/{album['id']}/locations", json={"location_id": location_id})

    response = await client.delete(f"/api/albums/{album['id']}/locations/{location_id}")

    assert response.status_code == 204
    assert (await client.get(f"/api/albums/{album['id']}")).json()["locations"] == []
    assert (await client.get(f"/api/locations/{location_id}")).status_code == 200


async def test_remove_location_not_in_album_is_404(client: AsyncClient) -> None:
    album = await _create_album(client)
    location_id = await _create_location(client)

    response = await client.delete(f"/api/albums/{album['id']}/locations/{location_id}")

    assert response.status_code == 404


async def test_deleting_location_removes_it_from_albums(client: AsyncClient) -> None:
    album = await _create_album(client)
    location_id = await _create_location(client)
    await client.post(f"/api/albums/{album['id']}/locations", json={"location_id": location_id})

    await client.delete(f"/api/locations/{location_id}")

    body = (await client.get(f"/api/albums/{album['id']}")).json()
    assert body["location_count"] == 0
    assert body["locations"] == []


async def test_albums_are_private_to_their_owner(
    client: AsyncClient, db_session: AsyncSession, authenticate: Login
) -> None:
    album = await _create_album(client)
    location_id = await _create_location(client)
    other = User(oidc_sub="test|user-2", email="other@example.com", settings={})
    db_session.add(other)
    await db_session.commit()
    authenticate(other)

    assert (await client.get("/api/albums")).json() == []
    assert (await client.get(f"/api/albums/{album['id']}")).status_code == 404
    assert (
        await client.patch(f"/api/albums/{album['id']}", json={"name": "Mine now"})
    ).status_code == 404
    assert (
        await client.post(f"/api/albums/{album['id']}/locations", json={"location_id": location_id})
    ).status_code == 404
    assert (await client.delete(f"/api/albums/{album['id']}")).status_code == 404


@pytest.mark.noauth
async def test_albums_require_authentication(client: AsyncClient) -> None:
    response = await client.get("/api/albums")

    assert response.status_code == 401
