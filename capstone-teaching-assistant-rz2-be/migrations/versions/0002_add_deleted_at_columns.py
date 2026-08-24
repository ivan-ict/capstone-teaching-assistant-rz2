"""add deleted_at columns

Revision ID: 0002_add_deleted_at_columns
Revises: 0001_initial_schema
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_add_deleted_at_columns"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SOFT_DELETE_TABLES = (
    "users",
    "faculties",
    "supervisor_profiles",
    "projects",
    "conversations",
    "files",
    "messages",
    "document_chunks",
    "message_files",
)


def upgrade() -> None:
    for table_name in SOFT_DELETE_TABLES:
        op.add_column(
            table_name,
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    for table_name in reversed(SOFT_DELETE_TABLES):
        op.drop_column(table_name, "deleted_at")
