"""Tests for the DEV_AUTH local-dev authentication bypass.

Marked ``noauth`` so the real ``get_current_user`` dependency runs (the default
fixture would otherwise inject a test user and hide the bypass). ``get_settings``
is overridden to enable dev auth for the request.
"""

from collections.abc import Iterator

import pytest
from httpx import AsyncClient

from app.config import Settings, get_settings
from app.main import app

pytestmark = [pytest.mark.usefixtures("client"), pytest.mark.noauth]


@pytest.fixture
def dev_auth() -> Iterator[None]:
    app.dependency_overrides[get_settings] = lambda: Settings(dev_auth=True)
    yield
    app.dependency_overrides.pop(get_settings, None)


async def test_dev_auth_allows_requests_without_a_token(
    client: AsyncClient, dev_auth: None
) -> None:
    response = await client.get("/api/me")

    assert response.status_code == 200
    assert response.json()["email"] == "dev@localhost"


async def test_dev_auth_reuses_the_same_user(client: AsyncClient, dev_auth: None) -> None:
    first = (await client.get("/api/me")).json()
    second = (await client.get("/api/me")).json()

    assert first["id"] == second["id"]


async def test_config_advertises_dev_auth(client: AsyncClient, dev_auth: None) -> None:
    response = await client.get("/api/config")

    assert response.status_code == 200
    assert response.json()["dev_auth"] is True


async def test_without_dev_auth_a_token_is_still_required(client: AsyncClient) -> None:
    # No dev_auth override here: the real dependency must still reject anonymous calls.
    response = await client.get("/api/me")

    assert response.status_code == 401
