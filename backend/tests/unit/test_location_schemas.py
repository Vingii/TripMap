import pytest
from pydantic import ValidationError

from app.schemas.location import LocationCreate, LocationUpdate


def test_create_accepts_valid_payload() -> None:
    location = LocationCreate(name="Berlin", lat=52.52, lng=13.405, country_code="DE")
    assert location.country_code == "DE"


def test_create_country_code_is_optional() -> None:
    location = LocationCreate(name="Berlin", lat=52.52, lng=13.405)
    assert location.country_code is None


@pytest.mark.parametrize("lat", [-90.1, 90.1])
def test_create_rejects_out_of_range_latitude(lat: float) -> None:
    with pytest.raises(ValidationError):
        LocationCreate(name="x", lat=lat, lng=0)


@pytest.mark.parametrize("lng", [-180.1, 180.1])
def test_create_rejects_out_of_range_longitude(lng: float) -> None:
    with pytest.raises(ValidationError):
        LocationCreate(name="x", lat=0, lng=lng)


def test_create_rejects_blank_name() -> None:
    with pytest.raises(ValidationError):
        LocationCreate(name="", lat=0, lng=0)


def test_update_allows_name_only() -> None:
    update = LocationUpdate(name="Renamed")
    assert update.lat is None and update.lng is None


def test_update_allows_both_coordinates() -> None:
    update = LocationUpdate(lat=10.0, lng=20.0)
    assert update.lat == 10.0 and update.lng == 20.0


@pytest.mark.parametrize(("lat", "lng"), [(10.0, None), (None, 20.0)])
def test_update_rejects_unpaired_coordinates(lat: float | None, lng: float | None) -> None:
    with pytest.raises(ValidationError, match="together"):
        LocationUpdate(lat=lat, lng=lng)


def test_update_rejects_malformed_country_code() -> None:
    with pytest.raises(ValidationError):
        LocationUpdate(country_code="DEU")
