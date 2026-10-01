"""replace location subdivision_code with subdivision_codes

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-01 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The single stored code was only the broadest level Nominatim reported,
    # which often is not the level the bundled admin-1 layer models. It cannot
    # be expanded without calling Nominatim, so existing rows reset to NULL and
    # `make backfill-subdivisions` re-resolves them.
    op.drop_column("locations", "subdivision_code")
    op.add_column(
        "locations",
        sa.Column("subdivision_codes", postgresql.ARRAY(sa.String(length=6)), nullable=True),
    )


def downgrade() -> None:
    op.add_column("locations", sa.Column("subdivision_code", sa.String(length=6), nullable=True))
    op.execute("UPDATE locations SET subdivision_code = subdivision_codes[1]")
    op.drop_column("locations", "subdivision_codes")
