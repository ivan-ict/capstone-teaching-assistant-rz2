"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-08-22 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

user_role = postgresql.ENUM("ADMIN", "SUPERVISOR", name="user_role", create_type=False)
account_status = postgresql.ENUM("ACTIVE", "INACTIVE", name="account_status", create_type=False)
teaching_semester = postgresql.ENUM(
    "SEMESTER_1", "SEMESTER_2", name="teaching_semester", create_type=False
)
message_role = postgresql.ENUM("USER", "ASSISTANT", name="message_role", create_type=False)
message_status = postgresql.ENUM(
    "PENDING", "GENERATING", "COMPLETED", "FAILED", name="message_status", create_type=False
)
file_processing_status = postgresql.ENUM(
    "UPLOADED",
    "PROCESSING",
    "READY",
    "FAILED",
    name="file_processing_status",
    create_type=False,
)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    account_status.create(bind, checkfirst=True)
    teaching_semester.create(bind, checkfirst=True)
    message_role.create(bind, checkfirst=True)
    message_status.create(bind, checkfirst=True)
    file_processing_status.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("status", account_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("username", name=op.f("uq_users_username")),
    )
    op.create_table(
        "faculties",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_faculties")),
        sa.UniqueConstraint("code", name=op.f("uq_faculties_code")),
        sa.UniqueConstraint("name", name=op.f("uq_faculties_name")),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("supervisor_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["supervisor_id"],
            ["users.id"],
            name=op.f("fk_projects_supervisor_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
    )
    op.create_table(
        "supervisor_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("faculty_id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("teaching_year", sa.SmallInteger(), nullable=True),
        sa.Column("teaching_semester", teaching_semester, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["faculty_id"],
            ["faculties.id"],
            name=op.f("fk_supervisor_profiles_faculty_id_faculties"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_supervisor_profiles_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_supervisor_profiles")),
        sa.UniqueConstraint("email", name=op.f("uq_supervisor_profiles_email")),
        sa.UniqueConstraint("user_id", name=op.f("uq_supervisor_profiles_user_id")),
    )
    op.create_table(
        "conversations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("supervisor_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_conversations_project_id_projects"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["supervisor_id"],
            ["users.id"],
            name=op.f("fk_conversations_supervisor_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_conversations")),
    )
    op.create_table(
        "files",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("supervisor_id", sa.Uuid(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_base_url", sa.Text(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("processing_status", file_processing_status, nullable=False),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["supervisor_id"],
            ["users.id"],
            name=op.f("fk_files_supervisor_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_files")),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("role", message_role, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", message_status, nullable=False),
        sa.Column("sequence_no", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name=op.f("fk_messages_conversation_id_conversations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_messages")),
        sa.UniqueConstraint(
            "conversation_id", "sequence_no", name=op.f("uq_messages_conversation_id")
        ),
    )
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("embedding", Vector(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["files.id"],
            name=op.f("fk_document_chunks_file_id_files"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_document_chunks")),
        sa.UniqueConstraint("file_id", "chunk_index", name=op.f("uq_document_chunks_file_id")),
    )
    op.create_table(
        "message_files",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("message_id", sa.Uuid(), nullable=True),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name=op.f("fk_message_files_conversation_id_conversations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["files.id"],
            name=op.f("fk_message_files_file_id_files"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["messages.id"],
            name=op.f("fk_message_files_message_id_messages"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_message_files")),
        sa.UniqueConstraint(
            "conversation_id",
            "message_id",
            "file_id",
            name=op.f("uq_message_files_conversation_id"),
        ),
    )
    op.create_index(
        "uq_message_files_conversation_file_without_message",
        "message_files",
        ["conversation_id", "file_id"],
        unique=True,
        postgresql_where=sa.text("message_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_message_files_conversation_file_without_message",
        table_name="message_files",
        postgresql_where=sa.text("message_id IS NULL"),
    )
    op.drop_table("message_files")
    op.drop_table("document_chunks")
    op.drop_table("messages")
    op.drop_table("files")
    op.drop_table("conversations")
    op.drop_table("supervisor_profiles")
    op.drop_table("projects")
    op.drop_table("faculties")
    op.drop_table("users")
    bind = op.get_bind()
    file_processing_status.drop(bind, checkfirst=True)
    message_status.drop(bind, checkfirst=True)
    message_role.drop(bind, checkfirst=True)
    teaching_semester.drop(bind, checkfirst=True)
    account_status.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
