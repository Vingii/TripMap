"""Unit tests for OIDC token verification.

A throwaway RSA key signs test tokens; the matching public JWK is served through
a mocked HTTP transport so no network is touched.
"""

import json
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.services.auth import AuthError, OIDCVerifier

ISSUER = "https://idp.test"
AUDIENCE = "tripmap-client"
KID = "test-key"


@pytest.fixture(scope="module")
def signing_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="module")
def jwks(signing_key: rsa.RSAPrivateKey) -> dict[str, Any]:
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(signing_key.public_key()))
    jwk["kid"] = KID
    return {"keys": [jwk]}


def _verifier(jwks: dict[str, Any]) -> OIDCVerifier:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=jwks)

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url=ISSUER)
    return OIDCVerifier(http, issuer=ISSUER, audience=AUDIENCE, jwks_url=f"{ISSUER}/jwks")


def _token(signing_key: rsa.RSAPrivateKey, **overrides: Any) -> str:
    payload: dict[str, Any] = {
        "sub": "user-123",
        "email": "user@idp.test",
        "name": "Test User",
        "iss": ISSUER,
        "aud": AUDIENCE,
    }
    payload.update(overrides)
    return jwt.encode(payload, signing_key, algorithm="RS256", headers={"kid": KID})


async def test_verify_returns_identity_claims(
    signing_key: rsa.RSAPrivateKey, jwks: dict[str, Any]
) -> None:
    claims = await _verifier(jwks).verify(_token(signing_key))

    assert claims.sub == "user-123"
    assert claims.email == "user@idp.test"
    assert claims.name == "Test User"


async def test_verify_falls_back_to_preferred_username(
    signing_key: rsa.RSAPrivateKey, jwks: dict[str, Any]
) -> None:
    token = _token(signing_key, name=None, preferred_username="tuser")
    claims = await _verifier(jwks).verify(token)
    assert claims.name == "tuser"


async def test_verify_rejects_wrong_audience(
    signing_key: rsa.RSAPrivateKey, jwks: dict[str, Any]
) -> None:
    token = _token(signing_key, aud="some-other-client")
    with pytest.raises(AuthError):
        await _verifier(jwks).verify(token)


async def test_verify_rejects_wrong_issuer(
    signing_key: rsa.RSAPrivateKey, jwks: dict[str, Any]
) -> None:
    token = _token(signing_key, iss="https://evil.test")
    with pytest.raises(AuthError):
        await _verifier(jwks).verify(token)


async def test_verify_rejects_malformed_token(jwks: dict[str, Any]) -> None:
    with pytest.raises(AuthError):
        await _verifier(jwks).verify("not-a-jwt")


async def test_verify_requires_configuration(jwks: dict[str, Any]) -> None:
    http = httpx.AsyncClient(base_url=ISSUER)
    verifier = OIDCVerifier(http, issuer="", audience="")
    with pytest.raises(AuthError):
        await verifier.verify("whatever")
