from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.main import _mount_frontend
from app.routers import health


@pytest.fixture
def spa_app(tmp_path: Path) -> FastAPI:
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("<!doctype html><title>spa shell</title>")
    (static / "assets").mkdir()
    (static / "assets" / "main.js").write_text("console.log('ok')")
    (static / "favicon.svg").write_text("<svg/>")

    app = FastAPI(
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.include_router(health.router, prefix="/api")
    _mount_frontend(app, static)
    return app


@pytest.mark.asyncio
async def test_api_health_still_resolves(spa_app: FastAPI) -> None:
    transport = ASGITransport(app=spa_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_unknown_api_route_returns_404(spa_app: FastAPI) -> None:
    transport = ASGITransport(app=spa_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/non-existent")
    assert response.status_code == 404
    assert "spa shell" not in response.text


@pytest.mark.asyncio
async def test_bare_api_prefix_returns_404(spa_app: FastAPI) -> None:
    transport = ASGITransport(app=spa_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_unknown_spa_route_serves_index(spa_app: FastAPI) -> None:
    transport = ASGITransport(app=spa_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/map")
    assert response.status_code == 200
    assert "spa shell" in response.text


@pytest.mark.asyncio
async def test_static_file_served_at_root(spa_app: FastAPI) -> None:
    transport = ASGITransport(app=spa_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/favicon.svg")
    assert response.status_code == 200
    assert "<svg/>" in response.text


@pytest.mark.asyncio
async def test_hashed_asset_served_via_static_mount(spa_app: FastAPI) -> None:
    transport = ASGITransport(app=spa_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/assets/main.js")
    assert response.status_code == 200
    assert "console.log" in response.text
