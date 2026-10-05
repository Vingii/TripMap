import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.deps import get_current_user
from app.routers import albums, config, geocode, health, immich, locations, me
from app.services.auth import create_oidc_verifier
from app.services.geocode import create_geocode_service
from app.services.immich import ImmichError, create_immich_service


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if settings.dev_auth:
        logging.getLogger("uvicorn.error").warning(
            "DEV_AUTH is enabled: authentication is DISABLED and every request "
            "runs as a fixed local user. Never use this in production."
        )
    app.state.geocode_service = create_geocode_service(settings)
    app.state.oidc_verifier = create_oidc_verifier(settings)
    app.state.immich_service = create_immich_service(settings)
    try:
        yield
    finally:
        await app.state.geocode_service.aclose()
        await app.state.immich_service.aclose()
        await app.state.oidc_verifier.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="TripMap API",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=_lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(config.router, prefix="/api")
    # Geocoding has no per-user facet but still requires a signed-in user.
    app.include_router(geocode.router, prefix="/api", dependencies=[Depends(get_current_user)])
    app.include_router(locations.router, prefix="/api")
    app.include_router(albums.router, prefix="/api")
    app.include_router(me.router, prefix="/api")
    app.include_router(immich.router, prefix="/api")
    app.add_exception_handler(ImmichError, _immich_error)
    _mount_frontend(app, settings.static_dir)
    return app


async def _immich_error(_request: Request, exc: Exception) -> JSONResponse:
    """Immich failures carry their own status, in the default error body shape."""
    assert isinstance(exc, ImmichError)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


def _mount_frontend(app: FastAPI, static_dir: Path | None) -> None:
    if static_dir is None or not static_dir.is_dir():
        return

    assets_dir = static_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    index_file = static_dir / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = static_dir / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index_file)


app = create_app()
