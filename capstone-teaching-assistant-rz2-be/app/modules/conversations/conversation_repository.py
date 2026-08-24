from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.db_models import (
    Conversation,
    File,
    Message,
    MessageFile,
    Project,
)


class ConversationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def project_exists_for_supervisor(self, project_id: UUID, supervisor_id: UUID) -> bool:
        query = select(Project.id).where(
            Project.id == project_id,
            Project.supervisor_id == supervisor_id,
        )
        result = await self.session.scalar(query)
        return result is not None

    async def create(
        self, supervisor_id: UUID, project_id: UUID | None, title: str = "New conversation"
    ) -> Conversation:
        conversation = Conversation(
            supervisor_id=supervisor_id,
            project_id=project_id,
            title=title,
        )
        self.session.add(conversation)
        await self.session.flush()
        await self.session.refresh(conversation)
        return conversation

    async def list_conversations(
        self,
        supervisor_id: UUID,
        project_id: UUID | None = None,
        unprojected: bool = False,
    ) -> list[Conversation]:
        query = (
            select(Conversation)
            .where(Conversation.supervisor_id == supervisor_id)
            .options(selectinload(Conversation.project))
            .order_by(Conversation.updated_at.desc())
        )
        if unprojected:
            query = query.where(Conversation.project_id.is_(None))
        elif project_id is not None:
            query = query.where(Conversation.project_id == project_id)
        result = await self.session.scalars(query)
        return list(result)

    async def get_for_supervisor(
        self, conversation_id: UUID, supervisor_id: UUID
    ) -> Conversation | None:
        query = (
            select(Conversation)
            .where(
                Conversation.id == conversation_id,
                Conversation.supervisor_id == supervisor_id,
            )
            .options(selectinload(Conversation.project))
        )
        return await self.session.scalar(query)

    async def rename(self, conversation: Conversation, title: str) -> Conversation:
        conversation.title = title
        await self.session.flush()
        await self.session.refresh(conversation)
        return conversation

    async def move_to_project(
        self, conversation: Conversation, project_id: UUID | None
    ) -> Conversation:
        conversation.project_id = project_id
        await self.session.flush()
        await self.session.refresh(conversation)
        return conversation

    async def delete(self, conversation: Conversation) -> None:
        await self.session.delete(conversation)
        await self.session.flush()

    async def list_messages(self, conversation_id: UUID) -> list[Message]:
        query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .options(selectinload(Message.files).selectinload(MessageFile.file))
            .order_by(Message.sequence_no.asc())
        )
        result = await self.session.scalars(query)
        return list(result)

    async def list_files(self, conversation_id: UUID, supervisor_id: UUID) -> list[File]:
        query: Select[tuple[File]] = (
            select(File)
            .join(MessageFile, MessageFile.file_id == File.id)
            .where(MessageFile.conversation_id == conversation_id)
            .where(File.supervisor_id == supervisor_id)
            .distinct()
            .order_by(File.original_filename.asc())
        )
        result = await self.session.scalars(query)
        return list(result)

    async def list_files_by_ids_for_supervisor(
        self, file_ids: list[UUID], supervisor_id: UUID
    ) -> list[File]:
        query = (
            select(File)
            .where(File.id.in_(file_ids))
            .where(File.supervisor_id == supervisor_id)
            .order_by(File.original_filename.asc())
        )
        result = await self.session.scalars(query)
        return list(result)

    async def associate_files_to_conversation(
        self, conversation_id: UUID, files: list[File]
    ) -> list[File]:
        existing_query = (
            select(MessageFile.file_id)
            .where(MessageFile.conversation_id == conversation_id)
            .where(MessageFile.message_id.is_(None))
            .where(MessageFile.file_id.in_([file.id for file in files]))
        )
        existing_file_ids = set(await self.session.scalars(existing_query))
        for file in files:
            if file.id in existing_file_ids:
                continue
            self.session.add(
                MessageFile(
                    conversation_id=conversation_id,
                    message_id=None,
                    file_id=file.id,
                )
            )
        await self.session.flush()
        return files
