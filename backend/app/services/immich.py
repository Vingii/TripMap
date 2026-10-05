"""Brokered access to an Immich photo server.

Every Immich call goes through the backend so a user's Immich API key — stored
write-only in their settings — never reaches the browser. The server's base URL
is instance-wide configuration; the key is per user and passed in on each call.

Failures are raised as :class:`ImmichError` subclasses that carry the HTTP
status the API answers with. None of them is a 401: the SPA treats any 401 as
an expired TripMap session, and a bad *Immich* key must not sign the user out.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import Literal

import httpx

from app.config import Settings
from app.schemas.immich import ImmichAlbum, ImmichAlbumDetail, ImmichAsset

ThumbnailSize = Literal["thumbnail", "preview"]

# Immich caps a metadata search page at 1000 assets; the page limit is only a
# guard against a server that never stops reporting a next page.
_SEARCH_PAGE_SIZE = 1000
_MAX_SEARCH_PAGES = 100


class ImmichError(Exception):
    status_code = 502
    detail = "Immich request failed"

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.detail)
        if detail:
            self.detail = detail


class ImmichNotConfiguredError(ImmichError):
    status_code = 503
    detail = "Immich is not configured on this server"


class ImmichKeyMissingError(ImmichError):
    status_code = 400
    detail = "Add your Immich API key in Settings to use Immich"


class ImmichKeyRejectedError(ImmichError):
    status_code = 502
    detail = "Immich rejected the API key"


class ImmichNotFoundError(ImmichError):
    status_code = 404
    detail = "Not found in Immich"


class ImmichUnavailableError(ImmichError):
    status_code = 502
    detail = "Immich is unreachable"


class ImmichImage:
    """An image streamed from Immich; call :meth:`aclose` once consumed."""

    def __init__(self, response: httpx.Response) -> None:
        self._response = response
        self.media_type = response.headers.get("content-type", "application/octet-stream")

    def iter_bytes(self) -> AsyncIterator[bytes]:
        return self._response.aiter_bytes()

    async def aclose(self) -> None:
        await self._response.aclose()


class ImmichService:
    def __init__(self, client: httpx.AsyncClient | None) -> None:
        # ``None`` when IMMICH_BASE_URL is unset: every call then fails with
        # ImmichNotConfiguredError rather than reaching out anywhere.
        self._client = client

    @property
    def configured(self) -> bool:
        return self._client is not None

    async def search_albums(self, api_key: str | None, query: str = "") -> list[ImmichAlbum]:
        """Albums the key's owner can see (owned and shared) whose name contains
        ``query``, case-insensitively, sorted by name.

        Immich has no server-side name filter for albums, so the whole list is
        fetched and filtered here.
        """
        payload = await self._request_json(api_key, "GET", "/api/albums")
        if not isinstance(payload, list):
            raise ImmichUnavailableError("Unexpected response from Immich")
        needle = query.strip().casefold()
        albums = [_to_album(item) for item in payload if isinstance(item, dict)]
        return sorted(
            (a for a in albums if needle in a.name.casefold()),
            key=lambda a: a.name.casefold(),
        )

    async def get_album(
        self, api_key: str | None, album_id: str, *, with_assets: bool = True
    ) -> ImmichAlbumDetail:
        """An album and, unless ``with_assets`` is false, its assets.

        Immich 3 no longer embeds an album's assets in the album response, so
        they are listed through the paginated metadata search instead, in the
        album's own sort order.
        """
        checked_id = _checked_id(album_id)
        payload = await self._request_json(
            api_key, "GET", f"/api/albums/{checked_id}", params={"withoutAssets": "true"}
        )
        if not isinstance(payload, dict):
            raise ImmichUnavailableError("Unexpected response from Immich")
        album = _to_album(payload)
        if not with_assets:
            return ImmichAlbumDetail(**album.model_dump(), assets=[])
        order = "asc" if payload.get("order") == "asc" else "desc"
        assets = await self._album_assets(api_key, checked_id, order)
        return ImmichAlbumDetail(**album.model_dump(), assets=assets)

    async def _album_assets(
        self, api_key: str | None, album_id: str, order: str
    ) -> list[ImmichAsset]:
        assets: list[ImmichAsset] = []
        page = 1
        for _ in range(_MAX_SEARCH_PAGES):
            payload = await self._request_json(
                api_key,
                "POST",
                "/api/search/metadata",
                json={
                    "albumIds": [album_id],
                    "page": page,
                    "size": _SEARCH_PAGE_SIZE,
                    "order": order,
                },
            )
            result = payload.get("assets") if isinstance(payload, dict) else None
            if not isinstance(result, dict) or not isinstance(result.get("items"), list):
                raise ImmichUnavailableError("Unexpected response from Immich")
            assets.extend(
                ImmichAsset(id=str(a["id"]), type=str(a.get("type", "IMAGE")))
                for a in result["items"]
                if isinstance(a, dict) and "id" in a
            )
            # Immich reports the next page number as a string, or null at the end.
            next_page = result.get("nextPage")
            if not isinstance(next_page, (str, int)) or not str(next_page).isdigit():
                break
            page = int(next_page)
        return assets

    async def open_thumbnail(
        self, api_key: str | None, asset_id: str, size: ThumbnailSize = "thumbnail"
    ) -> ImmichImage:
        """Start streaming an asset's thumbnail (``preview`` is the large one)."""
        client, headers = self._prepare(api_key)
        request = client.build_request(
            "GET",
            f"/api/assets/{_checked_id(asset_id)}/thumbnail",
            params={"size": size},
            headers=headers,
        )
        try:
            response = await client.send(request, stream=True)
        except httpx.HTTPError as exc:
            raise ImmichUnavailableError from exc
        if response.is_error:
            await response.aread()
            await response.aclose()
            _raise_for_status(response)
        return ImmichImage(response)

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()

    def _prepare(self, api_key: str | None) -> tuple[httpx.AsyncClient, dict[str, str]]:
        if self._client is None:
            raise ImmichNotConfiguredError
        if not api_key:
            raise ImmichKeyMissingError
        return self._client, {"x-api-key": api_key}

    async def _request_json(
        self,
        api_key: str | None,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        json: dict[str, object] | None = None,
    ) -> object:
        client, headers = self._prepare(api_key)
        try:
            response = await client.request(method, path, params=params, json=json, headers=headers)
        except httpx.HTTPError as exc:
            raise ImmichUnavailableError from exc
        if response.is_error:
            _raise_for_status(response)
        try:
            return response.json()
        except ValueError as exc:
            raise ImmichUnavailableError("Unexpected response from Immich") from exc


def create_immich_service(settings: Settings) -> ImmichService:
    if not settings.immich_base_url:
        return ImmichService(None)
    client = httpx.AsyncClient(
        base_url=settings.immich_base_url.rstrip("/"),
        timeout=settings.immich_timeout_seconds,
    )
    return ImmichService(client)


def _checked_id(value: str) -> str:
    """Immich IDs are UUIDs; anything else cannot exist there, and must not be
    spliced into an upstream URL path."""
    try:
        return str(uuid.UUID(value))
    except ValueError as exc:
        raise ImmichNotFoundError from exc


def _raise_for_status(response: httpx.Response) -> None:
    status_code = response.status_code
    if status_code == 401:
        raise ImmichKeyRejectedError
    if status_code == 403:
        # A scoped key lacking a permission; Immich names it, e.g.
        # "Missing required permission: asset.view".
        raise ImmichKeyRejectedError(_immich_message(response))
    # Immich answers 400 ("Not found or no album.read access") as well as 404
    # for IDs the key cannot see.
    if status_code in (400, 404):
        raise ImmichNotFoundError
    raise ImmichUnavailableError(f"Immich returned HTTP {status_code}")


def _immich_message(response: httpx.Response) -> str | None:
    try:
        body = response.json()
    except ValueError:
        return None
    message = body.get("message") if isinstance(body, dict) else None
    return f"Immich refused the request: {message}" if isinstance(message, str) else None


def _to_album(item: dict[str, object]) -> ImmichAlbum:
    count = item.get("assetCount")
    thumbnail = item.get("albumThumbnailAssetId")
    return ImmichAlbum(
        id=str(item.get("id", "")),
        name=str(item.get("albumName", "")),
        asset_count=count if isinstance(count, int) else 0,
        thumbnail_asset_id=thumbnail if isinstance(thumbnail, str) and thumbnail else None,
    )
