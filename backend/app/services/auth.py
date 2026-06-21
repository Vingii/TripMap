"""OIDC bearer-token verification.

Protected endpoints expect a ``Bearer`` access token issued by the configured
OIDC provider (Authentik). We verify the token's RS256 signature against the
provider's JWKS, enforce the ``iss``/``aud`` claims, and surface the identity
claims the rest of the app needs. The JWKS is fetched lazily and cached; a
single retry refetches it when a token references an unknown ``kid`` (key
rotation).
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt import InvalidTokenError, PyJWKError

from app.config import Settings

_DISCOVERY_PATH = "/.well-known/openid-configuration"


class AuthError(Exception):
    """Raised when a token cannot be verified or is missing required claims."""


@dataclass(frozen=True)
class TokenClaims:
    """The identity claims we read off a verified access token."""

    sub: str
    email: str | None
    name: str | None


class OIDCVerifier:
    def __init__(
        self,
        http: httpx.AsyncClient,
        *,
        issuer: str,
        audience: str,
        jwks_url: str = "",
        cache_seconds: float = 3600.0,
    ) -> None:
        self._http = http
        self._issuer = issuer
        self._audience = audience
        self._cache_seconds = cache_seconds
        self._resolved_jwks_url = jwks_url
        self._jwks: dict[str, Any] | None = None
        self._jwks_fetched_at = 0.0

    async def aclose(self) -> None:
        await self._http.aclose()

    @classmethod
    def from_settings(cls, http: httpx.AsyncClient, settings: Settings) -> OIDCVerifier:
        return cls(
            http,
            issuer=settings.oidc_issuer,
            audience=settings.oidc_audience,
            jwks_url=settings.oidc_jwks_url,
            cache_seconds=settings.oidc_jwks_cache_seconds,
        )

    async def verify(self, token: str) -> TokenClaims:
        if not self._issuer or not self._audience:
            raise AuthError("OIDC is not configured")
        try:
            kid = jwt.get_unverified_header(token).get("kid")
        except InvalidTokenError as exc:
            raise AuthError("Malformed token") from exc

        signing_key = await self._signing_key(kid)
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=self._audience,
                issuer=self._issuer,
            )
        except InvalidTokenError as exc:
            raise AuthError(f"Invalid token: {exc}") from exc

        sub = claims.get("sub")
        if not isinstance(sub, str) or not sub:
            raise AuthError("Token has no subject")
        return TokenClaims(
            sub=sub,
            email=claims.get("email"),
            name=claims.get("name") or claims.get("preferred_username"),
        )

    async def _signing_key(self, kid: str | None) -> Any:
        key = self._find_key(await self._get_jwks(), kid)
        if key is None:
            # The key may have rotated since we last cached the JWKS; refetch once.
            key = self._find_key(await self._get_jwks(force=True), kid)
        if key is None:
            raise AuthError("No matching signing key for token")
        return key

    @staticmethod
    def _find_key(jwks: dict[str, Any], kid: str | None) -> Any:
        for jwk in jwks.get("keys", []):
            if kid is None or jwk.get("kid") == kid:
                try:
                    return jwt.PyJWK.from_dict(jwk).key
                except PyJWKError:
                    continue
        return None

    async def _get_jwks(self, *, force: bool = False) -> dict[str, Any]:
        now = time.monotonic()
        fresh = self._jwks is not None and now - self._jwks_fetched_at < self._cache_seconds
        if not force and fresh:
            assert self._jwks is not None
            return self._jwks
        try:
            response = await self._http.get(await self._jwks_url())
            response.raise_for_status()
            jwks: dict[str, Any] = response.json()
        except httpx.HTTPError as exc:
            raise AuthError("Could not fetch signing keys") from exc
        self._jwks = jwks
        self._jwks_fetched_at = now
        return jwks

    async def _jwks_url(self) -> str:
        if self._resolved_jwks_url:
            return self._resolved_jwks_url
        discovery = self._issuer.rstrip("/") + _DISCOVERY_PATH
        try:
            response = await self._http.get(discovery)
            response.raise_for_status()
            url = response.json().get("jwks_uri")
        except httpx.HTTPError as exc:
            raise AuthError("Could not load OIDC discovery document") from exc
        if not isinstance(url, str) or not url:
            raise AuthError("OIDC discovery document has no jwks_uri")
        self._resolved_jwks_url = url
        return url


def create_oidc_verifier(settings: Settings) -> OIDCVerifier:
    http = httpx.AsyncClient(timeout=10.0)
    return OIDCVerifier.from_settings(http, settings)
