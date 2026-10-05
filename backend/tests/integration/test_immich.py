"""End-to-end tests for the Immich proxy and album cover handling.

Immich itself is replaced by an ``httpx.MockTransport`` that serves one album
with two assets, so the tests exercise the real routes, settings lookup and DB
without a network.
"""

import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from httpx import AsyncClient

from app.deps import get_immich_service
from app.main import app
from app.services.immich import ImmichService

pytestmark = pytest.mark.usefixtures("client")

API_KEY = "immich-secret"
ALBUM_ID = "6f1c2c0e-2b7a-4a55-9a3e-1d2f3a4b5c6d"
OTHER_ALBUM_ID = "7a2d3d1f-3c8b-4b66-8b4f-2e3f4a5b6c7d"
GONE_ALBUM_ID = "8b3e4e2a-4d9c-4c77-9c5a-3f4a5b6c7d8e"
THUMB_ID = "0b9e8d7c-6a5b-4c3d-8e2f-1a2b3c4d5e6f"
OTHER_ASSET_ID = "1c0f9e8d-7b6c-4d5e-9f3a-2b3c4d5e6f7a"

# Immich 3 shape: the album carries no assets; they come from the metadata search.
ALBUM = {
    "id": ALBUM_ID,
    "albumName": "Paris 2023",
    "assetCount": 2,
    "albumThumbnailAssetId": THUMB_ID,
}
ASSETS = [{"id": THUMB_ID, "type": "IMAGE"}, {"id": OTHER_ASSET_ID, "type": "VIDEO"}]


def _immich(request: httpx.Request) -> httpx.Response:
    if request.headers.get("x-api-key") != API_KEY:
        return httpx.Response(401, json={"message": "Invalid API key"})
    path = request.url.path
    if path == "/api/albums":
        other = {"id": OTHER_ALBUM_ID, "albumName": "Alps", "assetCount": 0}
        return httpx.Response(200, json=[ALBUM, other])
    if path == f"/api/albums/{ALBUM_ID}":
        return httpx.Response(200, json=ALBUM)
    if path == "/api/search/metadata" and json.loads(request.content)["albumIds"] == [ALBUM_ID]:
        return httpx.Response(200, json={"assets": {"items": ASSETS, "nextPage": None}})
    if path.startswith("/api/assets/") and path.endswith("/thumbnail"):
        asset_id = path.split("/")[3]
        size = request.url.params["size"]
        return httpx.Response(
            200, content=f"{asset_id}:{size}".encode(), headers={"content-type": "image/jpeg"}
        )
    return httpx.Response(400, json={"message": "Not found or no album.read access"})


@pytest.fixture(autouse=True)
def immich_service() -> Iterator[None]:
    http = httpx.AsyncClient(transport=httpx.MockTransport(_immich), base_url="https://immich.test")
    service = ImmichService(http)
    app.dependency_overrides[get_immich_service] = lambda: service
    yield
    app.dependency_overrides.pop(get_immich_service, None)


async def _set_key(client: AsyncClient, key: str = API_KEY) -> None:
    response = await client.patch("/api/me/settings", json={"immich_api_key": key})
    assert response.status_code == 200, response.text


async def _create_album(client: AsyncClient, **overrides: Any) -> dict[str, Any]:
    payload = {"name": "Paris", "date": "2023-05-01", **overrides}
    response = await client.post("/api/albums", json=payload)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_search_albums_filters_by_name(client: AsyncClient) -> None:
    await _set_key(client)

    response = await client.get("/api/immich/albums", params={"q": "par"})

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": ALBUM_ID,
            "name": "Paris 2023",
            "asset_count": 2,
            "thumbnail_asset_id": THUMB_ID,
        }
    ]


async def test_search_without_key_is_400(client: AsyncClient) -> None:
    response = await client.get("/api/immich/albums")

    assert response.status_code == 400
    assert "API key" in response.json()["detail"]


async def test_rejected_key_is_not_reported_as_401(client: AsyncClient) -> None:
    # A 401 would make the SPA drop the TripMap session.
    await _set_key(client, "wrong-key")

    response = await client.get("/api/immich/albums")

    assert response.status_code == 502
    assert response.json() == {"detail": "Immich rejected the API key"}


async def test_unconfigured_immich_is_503(client: AsyncClient) -> None:
    await _set_key(client)
    app.dependency_overrides[get_immich_service] = lambda: ImmichService(None)

    response = await client.get("/api/immich/albums")

    assert response.status_code == 503


async def test_get_album_lists_assets(client: AsyncClient) -> None:
    await _set_key(client)

    response = await client.get(f"/api/immich/albums/{ALBUM_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Paris 2023"
    assert body["assets"] == [
        {"id": THUMB_ID, "type": "IMAGE"},
        {"id": OTHER_ASSET_ID, "type": "VIDEO"},
    ]


async def test_get_deleted_album_is_404(client: AsyncClient) -> None:
    await _set_key(client)

    response = await client.get(f"/api/immich/albums/{GONE_ALBUM_ID}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found in Immich"}


async def test_thumbnail_is_proxied_with_cache_headers(client: AsyncClient) -> None:
    await _set_key(client)

    response = await client.get(
        f"/api/immich/assets/{OTHER_ASSET_ID}/thumbnail", params={"size": "preview"}
    )

    assert response.status_code == 200
    assert response.content == f"{OTHER_ASSET_ID}:preview".encode()
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "private, max-age=86400"


async def test_thumbnail_rejects_unknown_size(client: AsyncClient) -> None:
    await _set_key(client)

    response = await client.get(
        f"/api/immich/assets/{OTHER_ASSET_ID}/thumbnail", params={"size": "original"}
    )

    assert response.status_code == 422


@pytest.mark.noauth
async def test_immich_routes_require_authentication(client: AsyncClient) -> None:
    assert (await client.get("/api/immich/albums")).status_code == 401
    assert (await client.get(f"/api/immich/assets/{THUMB_ID}/thumbnail")).status_code == 401


async def test_cover_falls_back_to_immich_album_thumbnail(client: AsyncClient) -> None:
    await _set_key(client)
    album = await _create_album(client, immich_album_id=ALBUM_ID)

    response = await client.get(f"/api/albums/{album['id']}/cover")

    assert response.status_code == 200
    assert response.content == f"{THUMB_ID}:thumbnail".encode()
    assert response.headers["cache-control"] == "private, no-cache"


async def test_cover_uses_chosen_asset(client: AsyncClient) -> None:
    await _set_key(client)
    album = await _create_album(client, immich_album_id=ALBUM_ID)
    patched = await client.patch(
        f"/api/albums/{album['id']}", json={"cover_asset_id": OTHER_ASSET_ID}
    )
    assert patched.json()["cover_asset_id"] == OTHER_ASSET_ID

    response = await client.get(f"/api/albums/{album['id']}/cover", params={"size": "preview"})

    assert response.content == f"{OTHER_ASSET_ID}:preview".encode()


async def test_cover_of_unlinked_album_is_404(client: AsyncClient) -> None:
    album = await _create_album(client)

    response = await client.get(f"/api/albums/{album['id']}/cover")

    assert response.status_code == 404


async def test_cover_of_deleted_immich_album_is_404(client: AsyncClient) -> None:
    await _set_key(client)
    album = await _create_album(client, immich_album_id=GONE_ALBUM_ID)

    response = await client.get(f"/api/albums/{album['id']}/cover")

    assert response.status_code == 404


async def test_unlinking_clears_cover(client: AsyncClient) -> None:
    album = await _create_album(client, immich_album_id=ALBUM_ID)
    await client.patch(f"/api/albums/{album['id']}", json={"cover_asset_id": THUMB_ID})

    response = await client.patch(f"/api/albums/{album['id']}", json={"immich_album_id": None})

    assert response.json()["immich_album_id"] is None
    assert response.json()["cover_asset_id"] is None


async def test_relinking_clears_cover_but_resaving_same_link_keeps_it(client: AsyncClient) -> None:
    album = await _create_album(client, immich_album_id=ALBUM_ID)
    url = f"/api/albums/{album['id']}"
    await client.patch(url, json={"cover_asset_id": THUMB_ID})

    same = await client.patch(url, json={"name": "Paris!", "immich_album_id": ALBUM_ID})
    assert same.json()["cover_asset_id"] == THUMB_ID

    relinked = await client.patch(url, json={"immich_album_id": OTHER_ALBUM_ID})
    assert relinked.json()["immich_album_id"] == OTHER_ALBUM_ID
    assert relinked.json()["cover_asset_id"] is None


async def test_cover_cannot_be_set_without_a_link(client: AsyncClient) -> None:
    album = await _create_album(client)

    response = await client.patch(f"/api/albums/{album['id']}", json={"cover_asset_id": THUMB_ID})

    assert response.json()["cover_asset_id"] is None
