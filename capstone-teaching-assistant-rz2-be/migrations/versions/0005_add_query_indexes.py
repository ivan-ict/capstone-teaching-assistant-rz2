"""add query indexes

Revision ID: 0005_add_query_indexes
Revises: 0004_add_revoked_tokens
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005_add_query_indexes"
down_revision: str | None = "0004_add_revoked_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        op.f("ix_projects_supervisor_deleted_updated"),
        "projects",
        ["supervisor_id", "deleted_at", "updated_at"],
    )
    op.create_index(
        op.f("ix_conversations_supervisor_deleted_updated"),
        "conversations",
        ["supervisor_id", "deleted_at", "updated_at"],
    )
    op.create_index(
        op.f("ix_conversations_project_deleted"),
        "conversations",
        ["project_id", "deleted_at"],
    )
    op.create_index(
        op.f("ix_files_supervisor_deleted_created"),
        "files",
        ["supervisor_id", "deleted_at", "created_at"],
    )
    op.create_index(
        op.f("ix_messages_conversation_deleted_sequence"),
        "messages",
        ["conversation_id", "deleted_at", "sequence_no"],
    )
    op.create_index(
        op.f("ix_message_files_conversation_deleted"),
        "message_files",
        ["conversation_id", "deleted_at"],
    )
    op.create_index(
        op.f("ix_message_files_file_deleted"),
        "message_files",
        ["file_id", "deleted_at"],
    )
    op.create_index(
        op.f("ix_document_chunks_file_deleted"),
        "document_chunks",
        ["file_id", "deleted_at"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_document_chunks_file_deleted"), table_name="document_chunks")
    op.drop_index(op.f("ix_message_files_file_deleted"), table_name="message_files")
    op.drop_index(op.f("ix_message_files_conversation_deleted"), table_name="message_files")
    op.drop_index(op.f("ix_messages_conversation_deleted_sequence"), table_name="messages")
    op.drop_index(op.f("ix_files_supervisor_deleted_created"), table_name="files")
    op.drop_index(op.f("ix_conversations_project_deleted"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_supervisor_deleted_updated"), table_name="conversations")
    op.drop_index(op.f("ix_projects_supervisor_deleted_updated"), table_name="projects")
