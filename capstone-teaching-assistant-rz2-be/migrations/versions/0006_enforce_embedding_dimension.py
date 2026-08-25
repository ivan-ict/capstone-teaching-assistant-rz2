"""enforce embedding dimension

Revision ID: 0006_enforce_embedding_dimension
Revises: 0005_add_query_indexes
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006_enforce_embedding_dimension"
down_revision: str | None = "0005_add_query_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE messages ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1024)")


def downgrade() -> None:
    op.execute("ALTER TABLE messages ALTER COLUMN embedding TYPE vector")
    op.execute("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector")
