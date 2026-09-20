from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.config import ClientConfig

router = APIRouter(tags=["config"])


@router.get("/config", response_model=ClientConfig)
async def get_client_config(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ClientConfig:
    """Expose the runtime settings the SPA reads on startup.

    Public (no auth) — the browser must read this before it holds any token.
    Contains no secrets: the issuer and public client ID are both visible in
    the authorization request anyway, and the Mapy.com key travels in the tile
    URLs the browser requests directly.
    """
    return ClientConfig(
        oidc_issuer=settings.oidc_issuer,
        oidc_client_id=settings.oidc_audience,
        dev_auth=settings.dev_auth,
        mapy_api_key=settings.mapy_api_key,
    )
