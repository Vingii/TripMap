import uuid

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.deps import CurrentUserDep, ImmichServiceDep, SessionDep
from app.routers.immich import stream_image
from app.schemas.album import AlbumCreate, AlbumDetail, AlbumLocationAdd, AlbumRead, AlbumUpdate
from app.services import albums as service
from app.services.immich import ThumbnailSize
from app.services.users import immich_api_key

router = APIRouter(prefix="/albums", tags=["albums"])

_NOT_FOUND = "Album not found"


@router.get("", response_model=list[AlbumRead])
async def list_albums(db: SessionDep, user: CurrentUserDep) -> list[AlbumRead]:
    return await service.list_albums(db, user.id)


@router.post("", response_model=AlbumDetail, status_code=status.HTTP_201_CREATED)
async def create_album(db: SessionDep, user: CurrentUserDep, payload: AlbumCreate) -> AlbumDetail:
    return await service.create_album(db, user.id, payload)


@router.get("/{album_id}", response_model=AlbumDetail)
async def get_album(db: SessionDep, user: CurrentUserDep, album_id: uuid.UUID) -> AlbumDetail:
    album = await service.get_album(db, user.id, album_id)
    if album is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    return album


@router.get(
    "/{album_id}/cover",
    response_class=StreamingResponse,
    responses={200: {"content": {"image/*": {}}}},
)
async def get_album_cover(
    db: SessionDep,
    user: CurrentUserDep,
    immich: ImmichServiceDep,
    album_id: uuid.UUID,
    size: ThumbnailSize = "thumbnail",
) -> StreamingResponse:
    """The album's cover image: the chosen cover asset, else the linked Immich
    album's own thumbnail.

    Not cacheable, unlike asset thumbnails — the same URL serves a different
    image once another cover is picked.
    """
    link = await service.get_immich_link(db, user.id, album_id)
    if link is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    immich_album_id, cover_asset_id = link
    if immich_album_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Album is not linked to Immich")

    api_key = immich_api_key(user)
    asset_id = (
        cover_asset_id
        or (await immich.get_album(api_key, immich_album_id, with_assets=False)).thumbnail_asset_id
    )
    if asset_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Album has no cover")
    image = await immich.open_thumbnail(api_key, asset_id, size)
    return stream_image(image, "private, no-cache")


@router.patch("/{album_id}", response_model=AlbumDetail)
async def update_album(
    db: SessionDep, user: CurrentUserDep, album_id: uuid.UUID, payload: AlbumUpdate
) -> AlbumDetail:
    album = await service.update_album(db, user.id, album_id, payload)
    if album is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    return album


@router.delete("/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_album(db: SessionDep, user: CurrentUserDep, album_id: uuid.UUID) -> None:
    if not await service.delete_album(db, user.id, album_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)


@router.post("/{album_id}/locations", response_model=AlbumDetail)
async def add_album_location(
    db: SessionDep, user: CurrentUserDep, album_id: uuid.UUID, payload: AlbumLocationAdd
) -> AlbumDetail:
    try:
        album = await service.add_location(db, user.id, album_id, payload.location_id)
    except service.LocationNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found") from exc
    if album is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    return album


@router.delete("/{album_id}/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_album_location(
    db: SessionDep, user: CurrentUserDep, album_id: uuid.UUID, location_id: uuid.UUID
) -> None:
    removed = await service.remove_location(db, user.id, album_id, location_id)
    if removed is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location is not in this album")
