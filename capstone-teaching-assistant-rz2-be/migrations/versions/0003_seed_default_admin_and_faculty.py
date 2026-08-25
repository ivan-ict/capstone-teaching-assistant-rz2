"""seed default faculty

Revision ID: 0003_seed_defaults
Revises: 0002_add_deleted_at_columns
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003_seed_defaults"
down_revision: str | None = "0002_add_deleted_at_columns"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FACULTY_ID = "00000000-0000-0000-0000-000000000010"


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO faculties (id, code, name, is_active, deleted_at)
        VALUES ('{FACULTY_ID}', 'SCI', 'School of Science', true, NULL)
        ON CONFLICT (code) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(f"DELETE FROM faculties WHERE id = '{FACULTY_ID}'")
