"""add album description, date, date precision and Immich album id

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-05 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: the type is created explicitly below, not by add_column.
date_precision = postgresql.ENUM("day", "month", "year", name="date_precision", create_type=False)


def upgrade() -> None:
    date_precision.create(op.get_bind(), checkfirst=False)
    op.add_column("albums", sa.Column("description", sa.Text(), nullable=True))
    # Albums had no API before this revision, but backfill any stray rows with
    # their creation day so the columns can be NOT NULL.
    op.add_column(
        "albums",
        sa.Column("date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
    )
    op.add_column(
        "albums",
        sa.Column(
            "date_precision",
            date_precision,
            nullable=False,
            server_default="day",
        ),
    )
    op.execute("UPDATE albums SET date = created_at::date")
    op.alter_column("albums", "date", server_default=None)
    op.alter_column("albums", "date_precision", server_default=None)
    op.add_column("albums", sa.Column("immich_album_id", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("albums", "immich_album_id")
    op.drop_column("albums", "date_precision")
    op.drop_column("albums", "date")
    op.drop_column("albums", "description")
    date_precision.drop(op.get_bind())
