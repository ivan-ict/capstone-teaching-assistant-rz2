import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.database import Base, SoftDeleteMixin, TimestampMixin

EMBEDDING_DIMENSION = 1024


class UserRole(enum.StrEnum):
    ADMIN = "ADMIN"
    SUPERVISOR = "SUPERVISOR"


class AccountStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class TeachingSemester(enum.StrEnum):
    SEMESTER_1 = "SEMESTER_1"
    SEMESTER_2 = "SEMESTER_2"


class MessageRole(enum.StrEnum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"


class MessageStatus(enum.StrEnum):
    PENDING = "PENDING"
    GENERATING = "GENERATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class FileProcessingStatus(enum.StrEnum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "uq_users_active_username",
            "username",
            unique=True,
            sqlite_where=text("deleted_at IS NULL"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus, name="account_status"), nullable=False
    )

    projects: Mapped[list[Project]] = relationship(back_populates="supervisor")
    conversations: Mapped[list[Conversation]] = relationship(back_populates="supervisor")
    files: Mapped[list[File]] = relationship(back_populates="supervisor")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    __table_args__ = (Index("ix_revoked_tokens_expires_at", "expires_at"),)

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class Faculty(TimestampMixin, Base):
    __tablename__ = "faculties"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class SupervisorProfile(TimestampMixin, Base):
    __tablename__ = "supervisor_profiles"
    __table_args__ = (
        Index(
            "uq_supervisor_profiles_active_email",
            "email",
            unique=True,
            sqlite_where=text("deleted_at IS NULL"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    faculty_id: Mapped[UUID] = mapped_column(ForeignKey("faculties.id"), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    teaching_year: Mapped[int | None] = mapped_column(SmallInteger)
    teaching_semester: Mapped[TeachingSemester | None] = mapped_column(
        Enum(TeachingSemester, name="teaching_semester")
    )


class Project(TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        Index(
            "ix_projects_supervisor_deleted_updated",
            "supervisor_id",
            "deleted_at",
            "updated_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    supervisor_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text)

    supervisor: Mapped[User] = relationship(back_populates="projects")
    conversations: Mapped[list[Conversation]] = relationship(back_populates="project")


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"
    __table_args__ = (
        Index(
            "ix_conversations_supervisor_deleted_updated",
            "supervisor_id",
            "deleted_at",
            "updated_at",
        ),
        Index("ix_conversations_project_deleted", "project_id", "deleted_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    supervisor_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[UUID | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="New conversation")

    supervisor: Mapped[User] = relationship(back_populates="conversations")
    project: Mapped[Project | None] = relationship(back_populates="conversations")
    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    message_files: Mapped[list[MessageFile]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class Message(TimestampMixin, Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("conversation_id", "sequence_no"),
        Index(
            "ix_messages_conversation_deleted_sequence",
            "conversation_id",
            "deleted_at",
            "sequence_no",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[MessageStatus] = mapped_column(
        Enum(MessageStatus, name="message_status"), nullable=False
    )
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIMENSION))
    sources: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list, nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    files: Mapped[list[MessageFile]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class File(TimestampMixin, Base):
    __tablename__ = "files"
    __table_args__ = (
        Index("ix_files_supervisor_deleted_created", "supervisor_id", "deleted_at", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    supervisor_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_base_url: Mapped[str] = mapped_column(Text, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    processing_status: Mapped[FileProcessingStatus] = mapped_column(
        Enum(FileProcessingStatus, name="file_processing_status"), nullable=False
    )
    processing_error: Mapped[str | None] = mapped_column(Text)

    supervisor: Mapped[User] = relationship(back_populates="files")
    message_files: Mapped[list[MessageFile]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )
    chunks: Mapped[list[DocumentChunk]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )


class MessageFile(SoftDeleteMixin, Base):
    __tablename__ = "message_files"
    __table_args__ = (
        UniqueConstraint("conversation_id", "message_id", "file_id"),
        Index("ix_message_files_conversation_deleted", "conversation_id", "deleted_at"),
        Index("ix_message_files_file_deleted", "file_id", "deleted_at"),
        Index(
            "uq_message_files_conversation_file_without_message",
            "conversation_id",
            "file_id",
            unique=True,
            sqlite_where=text("message_id IS NULL AND deleted_at IS NULL"),
            postgresql_where=text("message_id IS NULL AND deleted_at IS NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    message_id: Mapped[UUID | None] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"))
    file_id: Mapped[UUID] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    conversation: Mapped[Conversation] = relationship(back_populates="message_files")
    message: Mapped[Message | None] = relationship(back_populates="files")
    file: Mapped[File] = relationship(back_populates="message_files")


class DocumentChunk(SoftDeleteMixin, Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("file_id", "chunk_index"),
        Index("ix_document_chunks_file_deleted", "file_id", "deleted_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    file_id: Mapped[UUID] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSION), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    file: Mapped[File] = relationship(back_populates="chunks")

