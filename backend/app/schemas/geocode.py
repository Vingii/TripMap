from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Geographic extent of a place, used to frame the map view."""

    south: float
    north: float
    west: float
    east: float


class GeocodeResult(BaseModel):
    """A single ranked match for a forward-geocoding query."""

    name: str = Field(description="Human-readable place name.")
    lat: float
    lng: float
    country_code: str | None = Field(
        default=None, description="ISO 3166-1 alpha-2 country code, uppercased."
    )
    bounding_box: BoundingBox | None = Field(
        default=None, description="Extent of the place; absent when Nominatim omits it."
    )


class ReverseGeocodeResult(BaseModel):
    """The administrative context resolved for a coordinate."""

    country_code: str | None = Field(
        default=None, description="ISO 3166-1 alpha-2 country code, uppercased."
    )
