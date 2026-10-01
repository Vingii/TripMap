import uuid

from geoalchemy2 import Geography
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Location(TimestampMixin, Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    coordinates: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )
    # ISO 3166-1 alpha-2, derived from Nominatim reverse geocoding at creation time.
    # Nullable: reverse geocoding can fail or return no country (e.g. open ocean).
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    # Every ISO 3166-2 code Nominatim reports for the point, broadest level first
    # (e.g. ["FR-IDF", "FR-75"]), derived alongside country_code. All levels are
    # kept because which one the zone view's admin-1 layer models varies by
    # country. Empty when the place has no subdivision; NULL when it was never
    # resolved (geocoder unreachable, or the row predates the column) — the
    # backfill script picks those up.
    subdivision_codes: Mapped[list[str] | None] = mapped_column(ARRAY(String(6)), nullable=True)
