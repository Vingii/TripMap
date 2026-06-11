import httpx
import pytest

from app.services.geocode import GeocodeError, GeocodeService, _RateLimiter

SEARCH_PAYLOAD = [
    {
        "display_name": "Berlin, Germany",
        "lat": "52.5170365",
        "lon": "13.3888599",
        "address": {"country_code": "de"},
    },
    {
        "display_name": "Berlin, NH, USA",
        "lat": "44.4686109",
        "lon": "-71.1851053",
        "address": {"country_code": "us"},
    },
]


def _service(handler: object, *, rate_limit: float = 0.0) -> GeocodeService:
    transport = httpx.MockTransport(handler)  # type: ignore[arg-type]
    client = httpx.AsyncClient(transport=transport, base_url="https://nominatim.test")
    return GeocodeService(client, search_limit=10, rate_limiter=_RateLimiter(rate_limit))


async def test_search_maps_and_ranks_results() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/search"
        assert request.url.params["q"] == "Berlin"
        return httpx.Response(200, json=SEARCH_PAYLOAD)

    results = await _service(handler).search("Berlin")

    assert [r.name for r in results] == ["Berlin, Germany", "Berlin, NH, USA"]
    assert results[0].lat == pytest.approx(52.5170365)
    assert results[0].lng == pytest.approx(13.3888599)
    assert results[0].country_code == "DE"  # uppercased from Nominatim's lowercase


async def test_search_skips_entries_without_coordinates() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{"display_name": "no coords"}, SEARCH_PAYLOAD[0]])

    results = await _service(handler).search("Berlin")

    assert [r.name for r in results] == ["Berlin, Germany"]


async def test_reverse_returns_uppercased_country_code() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/reverse"
        assert request.url.params["lat"] == "52.52"
        assert request.url.params["lon"] == "13.405"
        return httpx.Response(200, json={"address": {"country_code": "de"}})

    result = await _service(handler).reverse(52.52, 13.405)

    assert result.country_code == "DE"


async def test_reverse_over_ocean_yields_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"error": "Unable to geocode"})

    result = await _service(handler).reverse(0.0, 0.0)

    assert result.country_code is None


async def test_upstream_error_status_raises_geocode_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    with pytest.raises(GeocodeError):
        await _service(handler).search("Berlin")


async def test_unreachable_upstream_raises_geocode_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    with pytest.raises(GeocodeError):
        await _service(handler).reverse(52.52, 13.405)


async def test_rate_limiter_skips_wait_on_first_call() -> None:
    limiter = _RateLimiter(1.0)
    # A single acquire must not block even though the configured interval is 1s.
    await limiter.acquire()
