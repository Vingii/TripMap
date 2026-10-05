"""Proxy for the user's Immich server.

Immich failures surface as :class:`~app.services.immich.ImmichError`, which the
app-wide exception handler turns into ``{"detail": …}`` with a non-401 status.
"""

from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.deps import CurrentUserDep, ImmichServiceDep
from app.schemas.immich import ImmichAlbum, ImmichAlbumDetail
from app.services.immich import ImmichImage, ThumbnailSize
from app.services.users import immich_api_key

router = APIRouter(prefix="/immich", tags=["immich"])

# Asset thumbnails never change for a given ID, so the browser may keep them.
ASSET_CACHE_CONTROL = "private, max-age=86400"


def stream_image(image: ImmichImage, cache_control: str) -> StreamingResponse:
    return StreamingResponse(
        image.iter_bytes(),
        media_type=image.media_type,
        headers={"Cache-Control": cache_control},
        background=BackgroundTask(image.aclose),
    )


@router.get("/albums", response_model=list[ImmichAlbum])
async def search_albums(
    user: CurrentUserDep,
    immich: ImmichServiceDep,
    q: Annotated[str, Query(max_length=255)] = "",
) -> list[ImmichAlbum]:
    return await immich.search_albums(immich_api_key(user), q)


@router.get("/albums/{album_id}", response_model=ImmichAlbumDetail)
async def get_album(
    user: CurrentUserDep, immich: ImmichServiceDep, album_id: str
) -> ImmichAlbumDetail:
    return await immich.get_album(immich_api_key(user), album_id)


@router.get(
    "/assets/{asset_id}/thumbnail",
    response_class=StreamingResponse,
    responses={200: {"content": {"image/*": {}}}},
)
async def get_asset_thumbnail(
    user: CurrentUserDep,
    immich: ImmichServiceDep,
    asset_id: str,
    size: ThumbnailSize = "thumbnail",
) -> StreamingResponse:
    image = await immich.open_thumbnail(immich_api_key(user), asset_id, size)
    return stream_image(image, ASSET_CACHE_CONTROL)
