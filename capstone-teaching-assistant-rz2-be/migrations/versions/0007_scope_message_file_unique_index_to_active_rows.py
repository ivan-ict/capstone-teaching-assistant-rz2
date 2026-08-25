"""scope message file unique index to active rows

Revision ID: 0007_scope_active_msg_file_idx
Revises: 0006_enforce_embedding_dimension
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_scope_active_msg_file_idx"
down_revision: str | None = "0006_enforce_embedding_dimension"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INDEX_NAME = "uq_message_files_conversation_file_without_message"


def upgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="message_files")
    op.create_index(
        INDEX_NAME,
        "message_files",
        ["conversation_id", "file_id"],
        unique=True,
        postgresql_where=sa.text("message_id IS NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="message_files")
    op.create_index(
        INDEX_NAME,
        "message_files",
        ["conversation_id", "file_id"],
        unique=True,
        postgresql_where=sa.text("message_id IS NULL"),
    )
