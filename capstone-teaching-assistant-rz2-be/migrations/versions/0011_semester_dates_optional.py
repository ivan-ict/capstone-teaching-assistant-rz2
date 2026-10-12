"""Make semester start and end dates optional.

The semester_dates check constraint is kept: it passes when either date is NULL.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_semester_dates_optional"
down_revision: str | None = "0010_semesters"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("semesters", "start_date", existing_type=sa.Date(), nullable=True)
    op.alter_column("semesters", "end_date", existing_type=sa.Date(), nullable=True)


def downgrade() -> None:
    op.execute("UPDATE semesters SET start_date = make_date(year, 1, 1) WHERE start_date IS NULL")
    op.execute("UPDATE semesters SET end_date = make_date(year, 12, 31) WHERE end_date IS NULL")
    op.alter_column("semesters", "end_date", existing_type=sa.Date(), nullable=False)
    op.alter_column("semesters", "start_date", existing_type=sa.Date(), nullable=False)
