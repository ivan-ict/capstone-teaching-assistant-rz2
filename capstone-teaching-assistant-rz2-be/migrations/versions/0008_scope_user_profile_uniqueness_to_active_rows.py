"""scope user and profile uniqueness to active rows

Revision ID: 0008_active_user_uniques
Revises: 0007_scope_active_msg_file_idx
Create Date: 2026-08-25 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_active_user_uniques"
down_revision: str | None = "0007_scope_active_msg_file_idx"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("uq_users_username"), "users", type_="unique")
    op.drop_constraint(op.f("uq_supervisor_profiles_email"), "supervisor_profiles", type_="unique")
    op.create_index(
        "uq_users_active_username",
        "users",
        ["username"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "uq_supervisor_profiles_active_email",
        "supervisor_profiles",
        ["email"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_supervisor_profiles_active_email", table_name="supervisor_profiles")
    op.drop_index("uq_users_active_username", table_name="users")
    op.create_unique_constraint(
        op.f("uq_supervisor_profiles_email"), "supervisor_profiles", ["email"]
    )
    op.create_unique_constraint(op.f("uq_users_username"), "users", ["username"])
