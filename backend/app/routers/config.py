from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.config import ClientConfig

router = APIRouter(tags=["config"])


@router.get("/config", response_model=ClientConfig)
async def get_client_config(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ClientConfig:
    """Expose the OIDC settings the SPA needs to start the login flow.

    Public (no auth) — the browser must read this before it holds any token.
    Contains no secrets: the issuer and public client ID are both visible in
    the authorization request anyway.
    """
    return ClientConfig(
        oidc_issuer=settings.oidc_issuer,
        oidc_client_id=settings.oidc_audience,
        dev_auth=settings.dev_auth,
    )
