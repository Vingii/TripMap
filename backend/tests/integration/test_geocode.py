from collections.abc import Iterator

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.deps import get_geocode_service
from app.main import app
from app.services.geocode import GeocodeService, _RateLimiter


def _stub_service(handler: object) -> GeocodeService:
    transport = httpx.MockTransport(handler)  # type: ignore[arg-type]
    client = httpx.AsyncClient(transport=transport, base_url="https://nominatim.test")
    return GeocodeService(client, search_limit=10, rate_limiter=_RateLimiter(0.0))


def _set(handler: object) -> None:
    app.dependency_overrides[get_geocode_service] = lambda: _stub_service(handler)


@pytest.fixture(autouse=True)
def _clear_overrides() -> Iterator[None]:
    yield
    app.dependency_overrides.pop(get_geocode_service, None)


async def _get(path: str) -> httpx.Response:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path)


async def test_search_returns_ranked_matches() -> None:
    _set(
        lambda request: httpx.Response(
            200,
            json=[
                {
                    "display_name": "Berlin, Germany",
                    "lat": "52.52",
                    "lon": "13.405",
                    "address": {"country_code": "de"},
                }
            ],
        )
    )

    response = await _get("/api/geocode/search?q=Berlin")

    assert response.status_code == 200
    assert response.json() == [
        {"name": "Berlin, Germany", "lat": 52.52, "lng": 13.405, "country_code": "DE"}
    ]


async def test_search_requires_a_query() -> None:
    _set(lambda request: httpx.Response(200, json=[]))

    response = await _get("/api/geocode/search?q=")

    assert response.status_code == 422


async def test_reverse_returns_country_code() -> None:
    _set(lambda request: httpx.Response(200, json={"address": {"country_code": "de"}}))

    response = await _get("/api/geocode/reverse?lat=52.52&lng=13.405")

    assert response.status_code == 200
    assert response.json() == {"country_code": "DE"}


async def test_reverse_rejects_out_of_range_coordinates() -> None:
    _set(lambda request: httpx.Response(200, json={}))

    response = await _get("/api/geocode/reverse?lat=999&lng=0")

    assert response.status_code == 422


async def test_upstream_failure_surfaces_as_502() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    _set(handler)

    response = await _get("/api/geocode/search?q=Berlin")

    assert response.status_code == 502
    assert response.json() == {"detail": "Geocoding service is unavailable"}
