from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
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
            Project.deleted_at.is_(None),
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
        page: int = 1,
        page_size: int = 100,
        search: str | None = None,
    ) -> list[Conversation]:
        query = (
            select(Conversation)
            .where(Conversation.supervisor_id == supervisor_id)
            .where(Conversation.deleted_at.is_(None))
            .options(selectinload(Conversation.project))
            .order_by(Conversation.updated_at.desc())
        )
        if unprojected:
            query = query.where(Conversation.project_id.is_(None))
        elif project_id is not None:
            query = query.where(Conversation.project_id == project_id)
        if search:
            query = (
                query.outerjoin(Message, Message.conversation_id == Conversation.id)
                .where(
                    or_(
                        Conversation.title.ilike(f"%{search}%"),
                        Message.content.ilike(f"%{search}%"),
                    )
                )
                .distinct()
            )
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.scalars(query)
        return list(result)

    async def count_conversations(
        self,
        supervisor_id: UUID,
        project_id: UUID | None = None,
        unprojected: bool = False,
        search: str | None = None,
    ) -> int:
        query = select(func.count(func.distinct(Conversation.id))).where(
            Conversation.supervisor_id == supervisor_id,
            Conversation.deleted_at.is_(None),
        )
        if unprojected:
            query = query.where(Conversation.project_id.is_(None))
        elif project_id is not None:
            query = query.where(Conversation.project_id == project_id)
        if search:
            query = query.outerjoin(Message, Message.conversation_id == Conversation.id).where(
                or_(
                    Conversation.title.ilike(f"%{search}%"),
                    Message.content.ilike(f"%{search}%"),
                )
            )
        return await self.session.scalar(query) or 0

    async def get_for_supervisor(
        self, conversation_id: UUID, supervisor_id: UUID
    ) -> Conversation | None:
        query = (
            select(Conversation)
            .where(
                Conversation.id == conversation_id,
                Conversation.supervisor_id == supervisor_id,
                Conversation.deleted_at.is_(None),
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
        deleted_at = datetime.now(UTC)
        conversation.deleted_at = deleted_at
        await self.session.execute(
            update(Message)
            .where(
                Message.conversation_id == conversation.id,
                Message.deleted_at.is_(None),
            )
            .values(deleted_at=deleted_at)
        )
        await self.session.execute(
            update(MessageFile)
            .where(
                MessageFile.conversation_id == conversation.id,
                MessageFile.deleted_at.is_(None),
            )
            .values(deleted_at=deleted_at)
        )
        await self.session.flush()

    async def list_messages(self, conversation_id: UUID) -> list[Message]:
        query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .where(Message.deleted_at.is_(None))
            .options(
                selectinload(Message.files).selectinload(MessageFile.file),
            )
            .order_by(Message.sequence_no.asc())
        )
        result = await self.session.scalars(query)
        return list(result)

    async def list_files(self, conversation_id: UUID, supervisor_id: UUID) -> list[File]:
        query: Select[tuple[File]] = (
            select(File)
            .join(MessageFile, MessageFile.file_id == File.id)
            .where(MessageFile.conversation_id == conversation_id)
            .where(MessageFile.deleted_at.is_(None))
            .where(File.supervisor_id == supervisor_id)
            .where(File.deleted_at.is_(None))
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
            .where(File.deleted_at.is_(None))
            .order_by(File.original_filename.asc())
        )
        result = await self.session.scalars(query)
        return list(result)

    async def list_preselected_file_ids(self, conversation_id: UUID) -> list[UUID]:
        query = (
            select(MessageFile.file_id)
            .join(File, File.id == MessageFile.file_id)
            .where(MessageFile.conversation_id == conversation_id)
            .where(MessageFile.message_id.is_(None))
            .where(MessageFile.deleted_at.is_(None))
            .where(File.deleted_at.is_(None))
        )
        return list(await self.session.scalars(query))

    async def associate_files_to_conversation(
        self, conversation_id: UUID, files: list[File]
    ) -> list[File]:
        existing_query = (
            select(MessageFile.file_id)
            .where(MessageFile.conversation_id == conversation_id)
            .where(MessageFile.message_id.is_(None))
            .where(MessageFile.deleted_at.is_(None))
            .where(MessageFile.file_id.in_([file.id for file in files]))
        )
        existing_file_ids = set(await self.session.scalars(existing_query))
        dialect_name = self.session.get_bind().dialect.name
        for file in files:
            if file.id in existing_file_ids:
                continue
            values = {
                "conversation_id": conversation_id,
                "message_id": None,
                "file_id": file.id,
            }
            if dialect_name == "sqlite":
                statement = sqlite_insert(MessageFile).values(**values)
            else:
                statement = postgresql_insert(MessageFile).values(**values)
            await self.session.execute(statement.on_conflict_do_nothing())
        await self.session.flush()
        return files

    async def dissociate_file(self, conversation_id: UUID, file_id: UUID) -> bool:
        result = await self.session.execute(
            update(MessageFile)
            .where(
                MessageFile.conversation_id == conversation_id,
                MessageFile.file_id == file_id,
                MessageFile.deleted_at.is_(None),
            )
            .values(deleted_at=datetime.now(UTC))
        )
        await self.session.flush()
        return bool(getattr(result, "rowcount", 0))
