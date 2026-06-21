import uuid
from datetime import datetime
from typing import Annotated, Self

from pydantic import BaseModel, Field, model_validator

Latitude = Annotated[float, Field(ge=-90, le=90, description="WGS84 latitude.")]
Longitude = Annotated[float, Field(ge=-180, le=180, description="WGS84 longitude.")]
CountryCode = Annotated[
    str, Field(min_length=2, max_length=2, description="ISO 3166-1 alpha-2, uppercased.")
]


class LocationCreate(BaseModel):
    """Payload for creating a location.

    ``country_code`` is optional: the name-search flow already knows it from the
    geocoder, while the map-click and manual-coordinate flows omit it and let the
    server reverse-geocode the coordinates to fill it in.
    """

    name: str = Field(min_length=1, max_length=255)
    lat: Latitude
    lng: Longitude
    country_code: CountryCode | None = None


class LocationUpdate(BaseModel):
    """Partial update of a location's name and/or coordinates.

    Coordinates are a unit: supply both ``lat`` and ``lng`` or neither. Changing
    them re-derives ``country_code`` via reverse geocoding unless one is given.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    lat: Latitude | None = None
    lng: Longitude | None = None
    country_code: CountryCode | None = None

    @model_validator(mode="after")
    def _coordinates_are_paired(self) -> Self:
        if (self.lat is None) != (self.lng is None):
            raise ValueError("lat and lng must be provided together")
        return self


class LocationVisitedUpdate(BaseModel):
    """Set whether the requesting user has visited a location."""

    visited: bool


class LocationRead(BaseModel):
    """A location as returned by the API.

    ``visited`` is scoped to the requesting user: it reflects whether *they* have
    a ``visited`` state for this location, not a property of the location itself.
    """

    id: uuid.UUID
    name: str
    lat: float
    lng: float
    country_code: str | None
    visited: bool = False
    created_at: datetime
    updated_at: datetime
