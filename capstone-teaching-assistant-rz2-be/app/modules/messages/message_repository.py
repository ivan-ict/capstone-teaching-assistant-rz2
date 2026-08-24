from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.db_models import (
    Conversation,
    DocumentChunk,
    File,
    FileProcessingStatus,
    Message,
    MessageFile,
    MessageRole,
    MessageStatus,
)


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_conversation_for_supervisor(
        self, conversation_id: UUID, supervisor_id: UUID
    ) -> Conversation | None:
        query = (
            select(Conversation)
            .where(Conversation.id == conversation_id, Conversation.supervisor_id == supervisor_id)
            .options(selectinload(Conversation.project))
        )
        return await self.session.scalar(query)

    async def get_message_for_supervisor(
        self, message_id: UUID, supervisor_id: UUID
    ) -> Message | None:
        query = (
            select(Message)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(Message.id == message_id, Conversation.supervisor_id == supervisor_id)
        )
        return await self.session.scalar(query)

    async def next_sequence_no(self, conversation_id: UUID) -> int:
        query = select(func.max(Message.sequence_no)).where(
            Message.conversation_id == conversation_id
        )
        current_max = await self.session.scalar(query)
        return (current_max or 0) + 1

    async def create_message(
        self,
        conversation_id: UUID,
        role: MessageRole,
        content: str,
        status: MessageStatus,
        sequence_no: int,
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            status=status,
            sequence_no=sequence_no,
        )
        self.session.add(message)
        await self.session.flush()
        await self.session.refresh(message)
        return message

    async def list_files_by_ids_for_supervisor(
        self, file_ids: list[UUID], supervisor_id: UUID
    ) -> list[File]:
        query = (
            select(File)
            .where(File.id.in_(file_ids))
            .where(File.supervisor_id == supervisor_id)
            .order_by(File.original_filename.asc())
        )
        return list(await self.session.scalars(query))

    async def list_conversation_file_ids(self, conversation_id: UUID) -> list[UUID]:
        query = select(MessageFile.file_id).where(MessageFile.conversation_id == conversation_id)
        return list(await self.session.scalars(query))

    async def associate_files_to_message(
        self, conversation_id: UUID, message_id: UUID, file_ids: list[UUID]
    ) -> None:
        for file_id in file_ids:
            self.session.add(
                MessageFile(
                    conversation_id=conversation_id,
                    message_id=message_id,
                    file_id=file_id,
                )
            )
        await self.session.flush()

    async def previous_user_message(self, assistant_message: Message) -> Message | None:
        query = (
            select(Message)
            .where(
                Message.conversation_id == assistant_message.conversation_id,
                Message.sequence_no < assistant_message.sequence_no,
                Message.role == MessageRole.USER,
            )
            .order_by(Message.sequence_no.desc())
            .limit(1)
        )
        return await self.session.scalar(query)

    async def list_history_before(self, message: Message, limit: int = 12) -> list[Message]:
        query = (
            select(Message)
            .where(
                Message.conversation_id == message.conversation_id,
                Message.sequence_no < message.sequence_no,
            )
            .order_by(Message.sequence_no.desc())
            .limit(limit)
        )
        messages = list(await self.session.scalars(query))
        messages.reverse()
        return messages

    async def list_message_file_ids(self, message_id: UUID) -> list[UUID]:
        query = select(MessageFile.file_id).where(MessageFile.message_id == message_id)
        return list(await self.session.scalars(query))

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
            .where(File.processing_status == FileProcessingStatus.READY)
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
    ) -> list[Message]:
        query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .where(Message.sequence_no < before_sequence_no)
            .where(Message.status == MessageStatus.COMPLETED)
            .where(Message.content != "")
            .where(Message.embedding.is_not(None))
            .limit(limit)
        )
        bind = self.session.get_bind()
        if bind.dialect.name == "sqlite":
            query = query.order_by(Message.sequence_no.desc())
        else:
            query = query.order_by(Message.embedding.cosine_distance(query_embedding))
        return list(await self.session.scalars(query))

    async def set_message_embedding(self, message: Message, embedding: list[float]) -> None:
        message.embedding = embedding
        await self.session.flush()

    async def set_message_state(
        self, message: Message, content: str, status: MessageStatus
    ) -> Message:
        message.content = content
        message.status = status
        await self.session.flush()
        await self.session.refresh(message)
        return message
