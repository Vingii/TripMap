import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings, get_settings
from app.main import app


@pytest.mark.asyncio
async def test_config_is_public_and_maps_audience_to_client_id() -> None:
    # The public client's OAuth2 client ID is the token audience; the endpoint
    # surfaces the backend's runtime OIDC env so the SPA needn't bake it in.
    app.dependency_overrides[get_settings] = lambda: Settings(
        oidc_issuer="https://auth.example.com/application/o/tripmap/",
        oidc_audience="tripmap-client",
    )
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/config")
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    assert response.json() == {
        "oidc_issuer": "https://auth.example.com/application/o/tripmap/",
        "oidc_client_id": "tripmap-client",
        "dev_auth": False,
    }
