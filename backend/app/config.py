from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    cors_origins: list[str] = ["http://localhost:5173"]
    static_dir: Path | None = None
    database_url: str = "postgresql+asyncpg://tripmap:tripmap@localhost:5432/tripmap"

    # OIDC (Authentik). Bearer JWTs are verified against the provider's JWKS.
    # When the issuer/audience are unset (e.g. local dev without an IdP) every
    # protected request fails verification and returns 401.
    oidc_issuer: str = ""
    oidc_audience: str = ""
    # Explicit JWKS endpoint; when empty it is discovered from the issuer's
    # ``/.well-known/openid-configuration`` document.
    oidc_jwks_url: str = ""
    # How long a fetched JWKS is reused before being refetched.
    oidc_jwks_cache_seconds: float = 3600.0

    # Nominatim geocoding. Override the base URL to point at a self-hosted instance.
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    nominatim_user_agent: str = "TripMap (https://github.com/Vingii/TripMap)"
    nominatim_timeout_seconds: float = 10.0
    nominatim_rate_limit_seconds: float = 1.0
    nominatim_search_limit: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
