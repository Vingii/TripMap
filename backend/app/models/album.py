import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class DatePrecision(str, enum.Enum):
    """How much of an album's ``date`` is meaningful — and so how it is displayed."""

    day = "day"
    month = "month"
    year = "year"


class Album(TimestampMixin, Base):
    __tablename__ = "albums"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Always a full date; with month/year precision the finer parts are just the
    # first of the period and are never displayed.
    date: Mapped[date] = mapped_column(Date, nullable=False)
    date_precision: Mapped[DatePrecision] = mapped_column(
        Enum(DatePrecision, name="date_precision"), nullable=False
    )
    immich_album_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )


class AlbumMember(TimestampMixin, Base):
    __tablename__ = "album_members"

    album_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("albums.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
