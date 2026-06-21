"""Tests for the current-user (`/api/me`) endpoints."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.usefixtures("client")


async def test_get_me_returns_profile_and_default_settings(client: AsyncClient) -> None:
    response = await client.get("/api/me")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "tester@example.com"
    assert body["display_name"] == "Tester"
    assert body["settings"] == {
        "theme": "system",
        "default_projection": "flat",
        "default_map_filter": "all",
    }


async def test_get_settings_returns_defaults(client: AsyncClient) -> None:
    response = await client.get("/api/me/settings")

    assert response.status_code == 200
    assert response.json()["theme"] == "system"


async def test_patch_settings_merges_partial_update(client: AsyncClient) -> None:
    first = await client.patch("/api/me/settings", json={"theme": "dark"})
    assert first.status_code == 200
    assert first.json()["theme"] == "dark"

    # A second partial patch leaves the previously-set key intact.
    second = await client.patch("/api/me/settings", json={"default_projection": "globe"})
    assert second.status_code == 200
    body = second.json()
    assert body["theme"] == "dark"
    assert body["default_projection"] == "globe"

    # Persisted: reflected by GET /me.
    me = (await client.get("/api/me")).json()
    assert me["settings"]["theme"] == "dark"
    assert me["settings"]["default_projection"] == "globe"


async def test_patch_settings_rejects_unknown_key(client: AsyncClient) -> None:
    response = await client.patch("/api/me/settings", json={"bogus": True})
    assert response.status_code == 422


async def test_patch_settings_rejects_invalid_value(client: AsyncClient) -> None:
    response = await client.patch("/api/me/settings", json={"theme": "neon"})
    assert response.status_code == 422
