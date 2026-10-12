from dataclasses import dataclass
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlalchemy.sql.elements import ColumnElement

from app.common.db_models import (
    Conversation,
    DocumentChunk,
    File,
    FileProcessingStatus,
    Message,
    MessageRole,
    MessageStatus,
    SupervisorProfile,
)


@dataclass(frozen=True)
class MessageGenerationContext:
    assistant_message: Message
    user_message: Message | None
    supervisor_id: UUID
    semester_id: UUID
    prepared_at: datetime


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def lock_message_creation_context(
        self, conversation_id: UUID, supervisor_id: UUID
    ) -> tuple[Conversation, int] | None:
        conversation = await self.session.scalar(
            select(Conversation)
            .join(SupervisorProfile, SupervisorProfile.user_id == Conversation.supervisor_id)
            .where(
                Conversation.id == conversation_id,
                Conversation.supervisor_id == supervisor_id,
                Conversation.semester_id == SupervisorProfile.semester_id,
                Conversation.deleted_at.is_(None),
                SupervisorProfile.deleted_at.is_(None),
            )
            .with_for_update(of=Conversation)
        )
        if conversation is None:
            return None
        sequence = await self.session.scalar(
            select(func.coalesce(func.max(Message.sequence_no), 0) + 1).where(
                Message.conversation_id == conversation_id
            )
        )
        return conversation, sequence or 1

    async def get_message_for_supervisor(
        self, message_id: UUID, supervisor_id: UUID
    ) -> Message | None:
        query = (
            select(Message)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(SupervisorProfile, SupervisorProfile.user_id == Conversation.supervisor_id)
            .where(
                SupervisorProfile.semester_id == Conversation.semester_id,
                SupervisorProfile.deleted_at.is_(None),
                Message.id == message_id,
                Message.deleted_at.is_(None),
                Conversation.supervisor_id == supervisor_id,
                Conversation.deleted_at.is_(None),
            )
        )
        return await self.session.scalar(query)

    async def get_message_generation_context(
        self, message_id: UUID, supervisor_id: UUID
    ) -> MessageGenerationContext | None:
        previous_user = aliased(Message)
        previous_user_id = (
            select(previous_user.id)
            .where(
                previous_user.conversation_id == Message.conversation_id,
                previous_user.sequence_no < Message.sequence_no,
                previous_user.role == MessageRole.USER,
                previous_user.deleted_at.is_(None),
            )
            .order_by(previous_user.sequence_no.desc())
            .limit(1)
            .correlate(Message)
            .scalar_subquery()
        )
        query = (
            select(Message, previous_user, Conversation.semester_id)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(SupervisorProfile, SupervisorProfile.user_id == Conversation.supervisor_id)
            .outerjoin(previous_user, previous_user.id == previous_user_id)
            .where(
                Message.id == message_id,
                Message.deleted_at.is_(None),
                Conversation.supervisor_id == supervisor_id,
                Conversation.deleted_at.is_(None),
                SupervisorProfile.deleted_at.is_(None),
                SupervisorProfile.semester_id == Conversation.semester_id,
            )
        )
        row = (await self.session.execute(query)).one_or_none()
        if row is None:
            return None
        return MessageGenerationContext(
            assistant_message=row[0],
            user_message=row[1],
            semester_id=row[2],
            supervisor_id=supervisor_id,
            prepared_at=datetime.now(UTC),
        )

    async def add_message_pair(
        self,
        conversation_id: UUID,
        content: str,
        user_sequence: int,
    ) -> tuple[Message, Message]:
        user_message = Message(
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=content,
            status=MessageStatus.COMPLETED,
            sequence_no=user_sequence,
        )
        assistant_message = Message(
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content="",
            status=MessageStatus.PENDING,
            sequence_no=user_sequence + 1,
        )
        self.session.add_all([user_message, assistant_message])
        await self.session.flush()
        return user_message, assistant_message

    async def list_history_before(self, message: Message, limit: int = 12) -> list[Message]:
        query = (
            select(Message)
            .where(
                Message.conversation_id == message.conversation_id,
                Message.sequence_no < message.sequence_no,
                Message.status == MessageStatus.COMPLETED,
                Message.content != "",
                Message.deleted_at.is_(None),
            )
            .order_by(Message.sequence_no.desc())
            .limit(limit)
        )
        messages = list(await self.session.scalars(query))
        messages.reverse()
        return messages

    def _conversation_scope(self, context: MessageGenerationContext) -> ColumnElement[bool]:
        return and_(
            Conversation.semester_id == context.semester_id,
            Conversation.supervisor_id == context.supervisor_id,
            Conversation.deleted_at.is_(None),
        )

    async def retrieve_chunks(
        self,
        context: MessageGenerationContext,
        query_embedding: list[float],
        limit: int,
    ) -> list[tuple[DocumentChunk, File, float | None]]:
        """Return the closest chunks with their cosine distance (None on SQLite)."""
        bind = self.session.get_bind()
        sqlite = bind.dialect.name == "sqlite"
        distance = DocumentChunk.embedding.cosine_distance(query_embedding)
        columns = (
            (DocumentChunk, File) if sqlite else (DocumentChunk, File, distance.label("distance"))
        )
        query = (
            select(*columns)
            .join(File, File.id == DocumentChunk.file_id)
            .where(
                File.semester_id == context.semester_id,
                DocumentChunk.deleted_at.is_(None),
                File.deleted_at.is_(None),
                File.processing_status == FileProcessingStatus.READY,
            )
            .limit(limit)
        )
        if sqlite:
            query = query.order_by(DocumentChunk.chunk_index.asc())
        else:
            query = query.order_by(distance)
        result = await self.session.execute(query)
        return [(row[0], row[1], None if sqlite else float(row[2])) for row in result.all()]

    async def retrieve_messages(
        self,
        context: MessageGenerationContext,
        before_sequence_no: int,
        query_embedding: list[float],
        limit: int,
        excluded_message_ids: set[UUID],
    ) -> list[Message]:
        query = (
            select(Message)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(self._conversation_scope(context))
            .where(
                or_(
                    and_(
                        Message.conversation_id == context.assistant_message.conversation_id,
                        Message.sequence_no < before_sequence_no,
                    ),
                    and_(
                        Message.conversation_id != context.assistant_message.conversation_id,
                        Message.created_at <= context.prepared_at,
                    ),
                )
            )
            .where(Message.status == MessageStatus.COMPLETED)
            .where(Message.content != "")
            .where(Message.embedding.is_not(None))
            .where(Message.deleted_at.is_(None))
            .limit(limit)
        )
        if excluded_message_ids:
            query = query.where(Message.id.not_in(excluded_message_ids))
        bind = self.session.get_bind()
        if bind.dialect.name == "sqlite":
            query = query.order_by(Message.sequence_no.desc())
        else:
            query = query.order_by(Message.embedding.cosine_distance(query_embedding))
        return list(await self.session.scalars(query))

    async def claim_pending_assistant_message(self, message: Message) -> bool:
        result = cast(
            CursorResult,
            await self.session.execute(
                update(Message)
                .where(
                    Message.id == message.id,
                    Message.status == MessageStatus.PENDING,
                    Message.deleted_at.is_(None),
                )
                .values(status=MessageStatus.GENERATING)
            ),
        )
        if result.rowcount != 1:
            return False
        message.status = MessageStatus.GENERATING
        return True

    def set_message_state(
        self,
        message: Message,
        content: str,
        status: MessageStatus,
        embedding: list[float] | None,
        sources: list[dict[str, object]] | None = None,
    ) -> Message:
        message.content = content
        message.status = status
        message.embedding = embedding
        if sources is not None:
            message.sources = sources
        return message
