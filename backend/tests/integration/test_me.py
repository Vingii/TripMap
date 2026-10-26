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
        "default_base_layer": "osm",
        "default_visited": True,
        "immich_api_key_set": False,
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


async def test_patch_default_base_layer(client: AsyncClient) -> None:
    response = await client.patch("/api/me/settings", json={"default_base_layer": "mapy"})
    assert response.status_code == 200
    assert response.json()["default_base_layer"] == "mapy"

    me = (await client.get("/api/me")).json()
    assert me["settings"]["default_base_layer"] == "mapy"


async def test_patch_default_visited(client: AsyncClient) -> None:
    response = await client.patch("/api/me/settings", json={"default_visited": False})
    assert response.status_code == 200
    assert response.json()["default_visited"] is False

    me = (await client.get("/api/me")).json()
    assert me["settings"]["default_visited"] is False


async def test_immich_api_key_is_write_only(client: AsyncClient) -> None:
    # Storing a key flips the "set" flag but never echoes the value back.
    stored = await client.patch("/api/me/settings", json={"immich_api_key": "super-secret"})
    assert stored.status_code == 200
    body = stored.json()
    assert body["immich_api_key_set"] is True
    assert "immich_api_key" not in body

    # A later read still masks the value.
    settings = (await client.get("/api/me/settings")).json()
    assert settings["immich_api_key_set"] is True
    assert "immich_api_key" not in settings


async def test_immich_api_key_can_be_cleared(client: AsyncClient) -> None:
    await client.patch("/api/me/settings", json={"immich_api_key": "super-secret"})

    # An empty string clears the stored key.
    cleared = await client.patch("/api/me/settings", json={"immich_api_key": ""})
    assert cleared.status_code == 200
    assert cleared.json()["immich_api_key_set"] is False


async def test_patch_settings_rejects_unknown_key(client: AsyncClient) -> None:
    response = await client.patch("/api/me/settings", json={"bogus": True})
    assert response.status_code == 422


async def test_patch_settings_rejects_invalid_value(client: AsyncClient) -> None:
    response = await client.patch("/api/me/settings", json={"theme": "neon"})
    assert response.status_code == 422


async def test_changelog_last_seen_starts_null(client: AsyncClient) -> None:
    response = await client.get("/api/me/changelog/last-seen")

    assert response.status_code == 200
    assert response.json() == {"last_seen_entry_id": None}


async def test_put_changelog_last_seen_persists(client: AsyncClient) -> None:
    put = await client.put("/api/me/changelog/last-seen", json={"entry_id": "2026-10-26"})
    assert put.status_code == 200
    assert put.json() == {"last_seen_entry_id": "2026-10-26"}

    get = await client.get("/api/me/changelog/last-seen")
    assert get.json() == {"last_seen_entry_id": "2026-10-26"}


@pytest.mark.parametrize("payload", [{"entry_id": ""}, {}, {"entry_id": "x" * 256}])
async def test_put_changelog_last_seen_rejects_invalid_ids(
    client: AsyncClient, payload: dict[str, str]
) -> None:
    response = await client.put("/api/me/changelog/last-seen", json=payload)

    assert response.status_code == 422


@pytest.mark.noauth
async def test_changelog_last_seen_requires_auth(client: AsyncClient) -> None:
    assert (await client.get("/api/me/changelog/last-seen")).status_code == 401
    put = await client.put("/api/me/changelog/last-seen", json={"entry_id": "a"})
    assert put.status_code == 401
