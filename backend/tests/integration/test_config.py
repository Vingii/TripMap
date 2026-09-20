import pytest
from httpx import ASGITransport, AsyncClient, Response

from app.config import Settings, get_settings
from app.main import app


async def _fetch_config(settings: Settings) -> Response:
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/api/config")
    finally:
        app.dependency_overrides.pop(get_settings, None)


@pytest.mark.asyncio
async def test_config_is_public_and_maps_audience_to_client_id() -> None:
    # The public client's OAuth2 client ID is the token audience; the endpoint
    # surfaces the backend's runtime OIDC env so the SPA needn't bake it in.
    response = await _fetch_config(
        Settings(
            oidc_issuer="https://auth.example.com/application/o/tripmap/",
            oidc_audience="tripmap-client",
        )
    )

    assert response.status_code == 200
    assert response.json() == {
        "oidc_issuer": "https://auth.example.com/application/o/tripmap/",
        "oidc_client_id": "tripmap-client",
        "dev_auth": False,
        # Unset by default, which is how the SPA knows to hide the layer.
        "mapy_api_key": "",
    }


@pytest.mark.asyncio
async def test_config_exposes_mapy_api_key() -> None:
    # The SPA needs the key at runtime to build Mapy.com tile URLs; it is never
    # baked into the build.
    response = await _fetch_config(Settings(mapy_api_key="test-mapy-key"))

    assert response.status_code == 200
    assert response.json()["mapy_api_key"] == "test-mapy-key"
