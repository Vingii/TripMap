from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    cors_origins: list[str] = ["http://localhost:5173"]
    static_dir: Path | None = None
    database_url: str = "postgresql+asyncpg://tripmap:tripmap@localhost:5432/tripmap"

    # Local-dev escape hatch. When true, protected endpoints skip OIDC entirely
    # and run as a single fixed local user, so the app is usable without an IdP.
    # NEVER enable in production — it disables authentication outright.
    dev_auth: bool = False

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

    # Mapy.com (Seznam) REST Tiles API. When set, the flat map offers Mapy.com
    # as an alternative base layer; when empty the option is hidden and the map
    # stays on OpenStreetMap. The key is handed to the browser via
    # ``GET /api/config`` because tiles are requested directly by the client —
    # it is a public, origin-restricted key, not a secret.
    mapy_api_key: str = ""

    # Countries (ISO 3166-1 alpha-2) the Zone view always draws at subdivision
    # level, as a comma-separated list, e.g. "CZ,DE". Instance-wide and read at
    # runtime, so a deployment can change it without rebuilding the image.
    zone_subdivision_countries: Annotated[list[str], NoDecode] = []

    @field_validator("zone_subdivision_countries", mode="before")
    @classmethod
    def _parse_country_list(cls, value: object) -> object:
        """Split the comma-separated env value into uppercased codes."""
        if not isinstance(value, str):
            return value
        codes = (part.strip().upper() for part in value.split(","))
        return list(dict.fromkeys(code for code in codes if code))

    @field_validator("zone_subdivision_countries")
    @classmethod
    def _check_country_codes(cls, value: list[str]) -> list[str]:
        invalid = [code for code in value if len(code) != 2 or not code.isalpha()]
        if invalid:
            raise ValueError(f"not ISO 3166-1 alpha-2 codes: {', '.join(invalid)}")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
