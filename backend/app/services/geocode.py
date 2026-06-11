"""Thin proxy over Nominatim for forward and reverse geocoding.

The backend brokers every Nominatim call so the upstream provider is never exposed
to the browser and can be swapped for a self-hosted instance via configuration. A
process-wide rate limiter keeps us inside Nominatim's usage policy (max ~1 req/s).
"""

from __future__ import annotations

import asyncio
import time

import httpx

from app.config import Settings
from app.schemas.geocode import BoundingBox, GeocodeResult, ReverseGeocodeResult


class GeocodeError(Exception):
    """Raised when the upstream geocoding provider is unreachable or returns an error."""


class _RateLimiter:
    """Serialises calls so consecutive requests stay at least ``min_interval`` apart."""

    def __init__(self, min_interval_seconds: float) -> None:
        self._min_interval = min_interval_seconds
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def acquire(self) -> None:
        if self._min_interval <= 0:
            return
        async with self._lock:
            wait = self._min_interval - (time.monotonic() - self._last_call)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_call = time.monotonic()


class GeocodeService:
    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        search_limit: int,
        rate_limiter: _RateLimiter,
    ) -> None:
        self._client = client
        self._search_limit = search_limit
        self._rate_limiter = rate_limiter

    async def search(self, query: str) -> list[GeocodeResult]:
        """Return a relevance-ranked list of places matching ``query``."""
        payload = await self._get(
            "/search",
            {
                "q": query,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": self._search_limit,
            },
        )
        if not isinstance(payload, list):
            raise GeocodeError("Unexpected response from geocoding provider")
        return [_to_result(item) for item in payload if _is_locatable(item)]

    async def reverse(self, lat: float, lng: float) -> ReverseGeocodeResult:
        """Resolve the country code (ISO 3166-1 alpha-2) for a coordinate."""
        payload = await self._get(
            "/reverse",
            {"lat": lat, "lon": lng, "format": "jsonv2", "addressdetails": 1},
        )
        if not isinstance(payload, dict):
            raise GeocodeError("Unexpected response from geocoding provider")
        return ReverseGeocodeResult(country_code=_country_code(payload))

    async def _get(self, path: str, params: dict[str, str | int | float]) -> object:
        await self._rate_limiter.acquire()
        try:
            response = await self._client.get(path, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise GeocodeError(str(exc)) from exc

    async def aclose(self) -> None:
        await self._client.aclose()


def create_geocode_service(settings: Settings) -> GeocodeService:
    client = httpx.AsyncClient(
        base_url=settings.nominatim_base_url,
        headers={"User-Agent": settings.nominatim_user_agent},
        timeout=settings.nominatim_timeout_seconds,
    )
    return GeocodeService(
        client,
        search_limit=settings.nominatim_search_limit,
        rate_limiter=_RateLimiter(settings.nominatim_rate_limit_seconds),
    )


def _is_locatable(item: object) -> bool:
    return isinstance(item, dict) and "lat" in item and "lon" in item


def _country_code(item: dict[str, object]) -> str | None:
    address = item.get("address")
    if not isinstance(address, dict):
        return None
    code = address.get("country_code")
    return code.upper() if isinstance(code, str) and code else None


def _to_result(item: dict[str, object]) -> GeocodeResult:
    return GeocodeResult(
        name=str(item.get("display_name", "")),
        lat=float(item["lat"]),  # type: ignore[arg-type]  # Nominatim sends numeric strings
        lng=float(item["lon"]),  # type: ignore[arg-type]
        country_code=_country_code(item),
        bounding_box=_bounding_box(item),
    )


def _bounding_box(item: dict[str, object]) -> BoundingBox | None:
    # Nominatim's boundingbox is [south, north, west, east] as numeric strings.
    raw = item.get("boundingbox")
    if not isinstance(raw, list) or len(raw) != 4:
        return None
    try:
        south, north, west, east = (float(v) for v in raw)
    except (TypeError, ValueError):
        return None
    return BoundingBox(south=south, north=north, west=west, east=east)
