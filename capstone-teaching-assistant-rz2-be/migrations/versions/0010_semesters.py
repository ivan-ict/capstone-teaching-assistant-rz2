"""Replace supervisor projects and attachments with shared semesters.

Run tools/reset_development_workspace.py before upgrading a populated development database.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_semesters"
down_revision: str | None = "0009_add_message_sources"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    for table in ("supervisor_profiles", "projects", "conversations", "files"):
        if bind.execute(sa.text(f"SELECT EXISTS (SELECT 1 FROM {table})")).scalar():
            raise RuntimeError(
                "Legacy workspace data exists. Run the explicit development workspace reset before migrating; no records were discarded."
            )
    if bind.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'SUPERVISOR')")
    ).scalar():
        raise RuntimeError("Reset development supervisor accounts before migrating.")
    op.create_table(
        "semesters",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("end_date >= start_date", name="semester_dates"),
    )
    op.add_column(
        "supervisor_profiles",
        sa.Column("semester_id", sa.Uuid(), sa.ForeignKey("semesters.id"), nullable=False),
    )
    op.create_index("ix_supervisor_profiles_semester_id", "supervisor_profiles", ["semester_id"])
    op.drop_column("supervisor_profiles", "teaching_year")
    op.drop_column("supervisor_profiles", "teaching_semester")
    op.execute("DROP TYPE teaching_semester")
    op.drop_table("message_files")
    op.drop_index("ix_conversations_project_deleted", table_name="conversations")
    op.drop_column("conversations", "project_id")
    op.add_column(
        "conversations",
        sa.Column("semester_id", sa.Uuid(), sa.ForeignKey("semesters.id"), nullable=False),
    )
    op.create_index(
        "ix_conversations_semester_supervisor_deleted",
        "conversations",
        ["semester_id", "supervisor_id", "deleted_at"],
    )
    op.drop_table("projects")
    op.drop_index("ix_files_supervisor_deleted_created", table_name="files")
    op.drop_column("files", "supervisor_id")
    op.add_column(
        "files", sa.Column("semester_id", sa.Uuid(), sa.ForeignKey("semesters.id"), nullable=False)
    )
    op.add_column(
        "files", sa.Column("uploaded_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False)
    )
    op.create_index(
        "ix_files_semester_deleted_created", "files", ["semester_id", "deleted_at", "created_at"]
    )


def downgrade() -> None:
    raise RuntimeError(
        "Semester ownership cannot be converted back to projects safely. Restore a pre-upgrade backup instead."
    )
