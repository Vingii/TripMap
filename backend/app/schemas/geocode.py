from pydantic import BaseModel, Field


class GeocodeResult(BaseModel):
    """A single ranked match for a forward-geocoding query."""

    name: str = Field(description="Human-readable place name.")
    lat: float
    lng: float
    country_code: str | None = Field(
        default=None, description="ISO 3166-1 alpha-2 country code, uppercased."
    )


class ReverseGeocodeResult(BaseModel):
    """The administrative context resolved for a coordinate."""

    country_code: str | None = Field(
        default=None, description="ISO 3166-1 alpha-2 country code, uppercased."
    )
