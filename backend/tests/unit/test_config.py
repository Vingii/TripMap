import pytest
from pydantic import ValidationError

from app.config import Settings


def test_zone_subdivision_countries_defaults_to_none() -> None:
    assert Settings().zone_subdivision_countries == []


def test_zone_subdivision_countries_parses_comma_separated_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ZONE_SUBDIVISION_COUNTRIES", " cz, DE,,cz ")

    assert Settings().zone_subdivision_countries == ["CZ", "DE"]


def test_zone_subdivision_countries_rejects_non_alpha2_codes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Fail at startup rather than silently ignoring a typo in the deployment.
    monkeypatch.setenv("ZONE_SUBDIVISION_COUNTRIES", "CZ,CZE")

    with pytest.raises(ValidationError, match="CZE"):
        Settings()
