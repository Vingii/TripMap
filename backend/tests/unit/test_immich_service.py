import json
from collections.abc import Callable

import httpx
import pytest

from app.services.immich import (
    ImmichKeyMissingError,
    ImmichKeyRejectedError,
    ImmichNotConfiguredError,
    ImmichNotFoundError,
    ImmichService,
    ImmichUnavailableError,
)

ALBUM_ID = "6f1c2c0e-2b7a-4a55-9a3e-1d2f3a4b5c6d"
ASSET_ID = "0b9e8d7c-6a5b-4c3d-8e2f-1a2b3c4d5e6f"

ALBUMS_PAYLOAD = [
    {"id": "a2", "albumName": "Paris 2023", "assetCount": 12, "albumThumbnailAssetId": "t2"},
    {"id": "a1", "albumName": "alps", "assetCount": 3, "albumThumbnailAssetId": None},
    {"id": "a3", "albumName": "Prague", "assetCount": 0},
]

Handler = Callable[[httpx.Request], httpx.Response]


def _service(handler: Handler) -> ImmichService:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://immich.test"
    )
    return ImmichService(client)


async def test_search_sends_key_and_filters_by_name() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/albums"
        assert request.headers["x-api-key"] == "secret"
        return httpx.Response(200, json=ALBUMS_PAYLOAD)

    albums = await _service(handler).search_albums("secret", "  PA ")

    assert [a.name for a in albums] == ["Paris 2023"]
    assert albums[0].asset_count == 12
    assert albums[0].thumbnail_asset_id == "t2"


async def test_search_without_query_lists_all_sorted_by_name() -> None:
    albums = await _service(lambda _r: httpx.Response(200, json=ALBUMS_PAYLOAD)).search_albums(
        "secret"
    )

    assert [a.id for a in albums] == ["a1", "a2", "a3"]
    assert albums[0].thumbnail_asset_id is None
    assert albums[2].asset_count == 0


def _album_handler(pages: list[list[dict[str, str]]], order: str = "desc") -> Handler:
    """Immich 3: album metadata without assets, assets via paged metadata search."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == f"/api/albums/{ALBUM_ID}":
            assert request.url.params["withoutAssets"] == "true"
            return httpx.Response(
                200,
                json={
                    "id": ALBUM_ID,
                    "albumName": "Paris",
                    "assetCount": sum(len(p) for p in pages),
                    "albumThumbnailAssetId": "x1",
                    "order": order,
                },
            )
        assert request.method == "POST"
        assert request.url.path == "/api/search/metadata"
        body = json.loads(request.content)
        assert body["albumIds"] == [ALBUM_ID]
        assert body["order"] == order
        page = body["page"]
        next_page = str(page + 1) if page < len(pages) else None
        items = pages[page - 1]
        return httpx.Response(
            200,
            json={"assets": {"items": items, "count": len(items), "nextPage": next_page}},
        )

    return handler


async def test_get_album_lists_assets_via_search() -> None:
    pages = [[{"id": "x1", "type": "IMAGE"}, {"id": "x2", "type": "VIDEO"}]]

    album = await _service(_album_handler(pages)).get_album("secret", ALBUM_ID)

    assert album.name == "Paris"
    assert album.thumbnail_asset_id == "x1"
    assert [(a.id, a.type) for a in album.assets] == [("x1", "IMAGE"), ("x2", "VIDEO")]


async def test_get_album_follows_search_pages_in_album_order() -> None:
    pages = [[{"id": "x1", "type": "IMAGE"}], [{"id": "x2", "type": "IMAGE"}]]

    album = await _service(_album_handler(pages, order="asc")).get_album("secret", ALBUM_ID)

    assert [a.id for a in album.assets] == ["x1", "x2"]


async def test_get_album_can_skip_assets() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/api/albums/{ALBUM_ID}", "assets must not be searched"
        return httpx.Response(200, json={"id": ALBUM_ID, "albumName": "Paris", "assetCount": 9})

    album = await _service(handler).get_album("secret", ALBUM_ID, with_assets=False)

    assert album.asset_count == 9
    assert album.assets == []


async def test_non_uuid_id_is_not_found_without_a_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"unexpected request: {request.url}")

    with pytest.raises(ImmichNotFoundError):
        await _service(handler).get_album("secret", "../users")


@pytest.mark.parametrize(
    ("status", "error"),
    [
        (400, ImmichNotFoundError),
        (404, ImmichNotFoundError),
        (401, ImmichKeyRejectedError),
        (403, ImmichKeyRejectedError),
        (500, ImmichUnavailableError),
    ],
)
async def test_upstream_status_maps_to_error(status: int, error: type[Exception]) -> None:
    service = _service(lambda _r: httpx.Response(status, json={"message": "nope"}))

    with pytest.raises(error):
        await service.get_album("secret", ALBUM_ID)


async def test_missing_permission_names_it() -> None:
    service = _service(
        lambda _r: httpx.Response(403, json={"message": "Missing required permission: asset.view"})
    )

    with pytest.raises(ImmichKeyRejectedError, match="asset.view"):
        await service.open_thumbnail("secret", ASSET_ID)


async def test_network_failure_is_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(ImmichUnavailableError):
        await _service(handler).search_albums("secret")


async def test_missing_key_fails_before_any_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"unexpected request: {request.url}")

    with pytest.raises(ImmichKeyMissingError):
        await _service(handler).search_albums(None)


async def test_unconfigured_service_raises() -> None:
    with pytest.raises(ImmichNotConfiguredError):
        await ImmichService(None).search_albums("secret")


async def test_open_thumbnail_streams_image() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/api/assets/{ASSET_ID}/thumbnail"
        assert request.url.params["size"] == "preview"
        assert request.headers["x-api-key"] == "secret"
        return httpx.Response(200, content=b"img-bytes", headers={"content-type": "image/webp"})

    image = await _service(handler).open_thumbnail("secret", ASSET_ID, "preview")
    body = b"".join([chunk async for chunk in image.iter_bytes()])
    await image.aclose()

    assert image.media_type == "image/webp"
    assert body == b"img-bytes"


async def test_open_thumbnail_maps_missing_asset() -> None:
    service = _service(lambda _r: httpx.Response(400, json={"message": "no access"}))

    with pytest.raises(ImmichNotFoundError):
        await service.open_thumbnail("secret", ASSET_ID)
