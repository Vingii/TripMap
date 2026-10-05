from pydantic import BaseModel


class ImmichAlbum(BaseModel):
    """An Immich album as offered by the album picker."""

    id: str
    name: str
    asset_count: int
    # Immich's own cover for the album; ``None`` for an empty album.
    thumbnail_asset_id: str | None


class ImmichAsset(BaseModel):
    id: str
    # Immich's asset type: ``IMAGE``, ``VIDEO``, …
    type: str


class ImmichAlbumDetail(ImmichAlbum):
    """An Immich album with its assets, in Immich's display order."""

    assets: list[ImmichAsset]
