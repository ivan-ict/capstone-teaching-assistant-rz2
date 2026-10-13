"""Store usernames in lowercase so sign-in is case-insensitive.

Revision ID: 0012_lowercase_usernames
Revises: 0011_semester_dates_optional
Create Date: 2026-10-13 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_lowercase_usernames"
down_revision: str | None = "0011_semester_dates_optional"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    collisions = (
        connection.execute(
            sa.text(
                "SELECT lower(username) FROM users WHERE deleted_at IS NULL "
                "GROUP BY lower(username) HAVING count(*) > 1"
            )
        )
        .scalars()
        .all()
    )
    if collisions:
        msg = (
            "Cannot lowercase usernames; these active usernames differ only by case: "
            + ", ".join(collisions)
        )
        raise RuntimeError(msg)
    op.execute("UPDATE users SET username = lower(username) WHERE username <> lower(username)")


def downgrade() -> None:
    # Original casing is not recoverable; lowercase usernames remain valid.
    pass
