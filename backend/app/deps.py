from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models.user import User
from app.services.auth import AuthError, OIDCVerifier, TokenClaims
from app.services.geocode import GeocodeService
from app.services.users import get_or_create_user

SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]

# The fixed identity every request runs as when DEV_AUTH is enabled (local dev
# only). Stable so the same User row is reused across restarts.
_DEV_CLAIMS = TokenClaims(sub="dev-auth|local", email="dev@localhost", name="Local Dev")


def get_geocode_service(request: Request) -> GeocodeService:
    service: GeocodeService = request.app.state.geocode_service
    return service


GeocodeServiceDep = Annotated[GeocodeService, Depends(get_geocode_service)]


def get_oidc_verifier(request: Request) -> OIDCVerifier:
    verifier: OIDCVerifier = request.app.state.oidc_verifier
    return verifier


OIDCVerifierDep = Annotated[OIDCVerifier, Depends(get_oidc_verifier)]

# auto_error=False so a missing header yields our 401 rather than HTTPBearer's 403.
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    db: SessionDep,
    settings: SettingsDep,
    verifier: OIDCVerifierDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    # Local-dev bypass: accept every request as the fixed dev user, no token needed.
    if settings.dev_auth:
        return await get_or_create_user(db, _DEV_CLAIMS)
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = await verifier.verify(credentials.credentials)
    except AuthError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return await get_or_create_user(db, claims)


CurrentUserDep = Annotated[User, Depends(get_current_user)]
