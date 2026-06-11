from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    cors_origins: list[str] = ["http://localhost:5173"]
    static_dir: Path | None = None
    database_url: str = "postgresql+asyncpg://tripmap:tripmap@localhost:5432/tripmap"

    # Nominatim geocoding. Override the base URL to point at a self-hosted instance.
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    nominatim_user_agent: str = "TripMap (https://github.com/Vingii/TripMap)"
    nominatim_timeout_seconds: float = 10.0
    nominatim_rate_limit_seconds: float = 1.0
    nominatim_search_limit: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
