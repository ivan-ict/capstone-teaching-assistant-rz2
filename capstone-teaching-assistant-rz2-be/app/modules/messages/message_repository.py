from dataclasses import dataclass
from typing import cast
from uuid import UUID

from sqlalchemy import and_, func, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.common.db_models import (
    Conversation,
    DocumentChunk,
    File,
    FileProcessingStatus,
    Message,
    MessageFile,
    MessageRole,
    MessageStatus,
    Project,
)


@dataclass(frozen=True)
class MessageGenerationContext:
    assistant_message: Message
    user_message: Message | None
    project_instructions: str | None
    file_ids: list[UUID]


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def lock_message_creation_context(
        self, conversation_id: UUID, supervisor_id: UUID
    ) -> tuple[Conversation, list[UUID], int] | None:
        next_sequence = (
            select(func.coalesce(func.max(Message.sequence_no), 0) + 1)
            .where(Message.conversation_id == Conversation.id)
            .correlate(Conversation)
            .scalar_subquery()
        )
        query = (
            select(Conversation, File.id, next_sequence)
            .outerjoin(
                MessageFile,
                and_(
                    MessageFile.conversation_id == Conversation.id,
                    MessageFile.message_id.is_(None),
                    MessageFile.deleted_at.is_(None),
                ),
            )
            .outerjoin(
                File,
                and_(File.id == MessageFile.file_id, File.deleted_at.is_(None)),
            )
            .where(
                Conversation.id == conversation_id,
                Conversation.supervisor_id == supervisor_id,
                Conversation.deleted_at.is_(None),
            )
            .with_for_update(of=Conversation)
        )
        rows = (await self.session.execute(query)).all()
        if not rows:
            return None
        conversation = rows[0][0]
        preselected_file_ids = list(dict.fromkeys(row[1] for row in rows if row[1] is not None))
        return conversation, preselected_file_ids, rows[0][2]

    async def get_message_for_supervisor(
        self, message_id: UUID, supervisor_id: UUID
    ) -> Message | None:
        query = (
            select(Message)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(
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
            select(Message, previous_user, Project.instructions, MessageFile.file_id)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .outerjoin(previous_user, previous_user.id == previous_user_id)
            .outerjoin(Project, Project.id == Conversation.project_id)
            .outerjoin(
                MessageFile,
                and_(
                    MessageFile.message_id == previous_user.id,
                    MessageFile.deleted_at.is_(None),
                ),
            )
            .where(
                Message.id == message_id,
                Message.deleted_at.is_(None),
                Conversation.supervisor_id == supervisor_id,
                Conversation.deleted_at.is_(None),
            )
        )
        rows = (await self.session.execute(query)).all()
        if not rows:
            return None
        return MessageGenerationContext(
            assistant_message=rows[0][0],
            user_message=rows[0][1],
            project_instructions=rows[0][2],
            file_ids=list(dict.fromkeys(row[3] for row in rows if row[3] is not None)),
        )

    async def list_files_by_ids_for_supervisor(
        self, file_ids: list[UUID], supervisor_id: UUID
    ) -> list[File]:
        query = (
            select(File)
            .where(File.id.in_(file_ids))
            .where(File.supervisor_id == supervisor_id)
            .where(File.deleted_at.is_(None))
            .order_by(File.original_filename.asc())
        )
        return list(await self.session.scalars(query))

    async def add_message_pair(
        self,
        conversation_id: UUID,
        content: str,
        user_sequence: int,
        file_ids: list[UUID],
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
        self.session.add_all(
            MessageFile(
                conversation_id=conversation_id,
                message_id=user_message.id,
                file_id=file_id,
            )
            for file_id in file_ids
        )
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

    async def retrieve_chunks(
        self,
        file_ids: list[UUID],
        query_embedding: list[float],
        limit: int,
    ) -> list[tuple[DocumentChunk, File]]:
        query = (
            select(DocumentChunk, File)
            .join(File, File.id == DocumentChunk.file_id)
            .where(DocumentChunk.file_id.in_(file_ids))
            .where(DocumentChunk.deleted_at.is_(None))
            .where(File.processing_status == FileProcessingStatus.READY)
            .where(File.deleted_at.is_(None))
            .limit(limit)
        )
        bind = self.session.get_bind()
        if bind.dialect.name == "sqlite":
            query = query.order_by(DocumentChunk.chunk_index.asc())
        else:
            query = query.order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        result = await self.session.execute(query)
        return [(row[0], row[1]) for row in result.all()]

    async def retrieve_messages(
        self,
        conversation_id: UUID,
        before_sequence_no: int,
        query_embedding: list[float],
        limit: int,
        excluded_message_ids: set[UUID],
    ) -> list[Message]:
        query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .where(Message.sequence_no < before_sequence_no)
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
