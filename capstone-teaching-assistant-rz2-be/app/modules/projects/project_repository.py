from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import Conversation, File, MessageFile, Project


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, supervisor_id: UUID, name: str, instructions: str | None) -> Project:
        project = Project(supervisor_id=supervisor_id, name=name, instructions=instructions)
        self.session.add(project)
        await self.session.flush()
        await self.session.refresh(project)
        return project

    async def list_for_supervisor(self, supervisor_id: UUID) -> list[Project]:
        query = (
            select(Project)
            .where(Project.supervisor_id == supervisor_id, Project.deleted_at.is_(None))
            .order_by(Project.updated_at.desc())
        )
        return list(await self.session.scalars(query))

    async def get_for_supervisor(self, project_id: UUID, supervisor_id: UUID) -> Project | None:
        query = select(Project).where(
            Project.id == project_id,
            Project.supervisor_id == supervisor_id,
            Project.deleted_at.is_(None),
        )
        return await self.session.scalar(query)

    async def update(
        self,
        project: Project,
        name: str | None,
        instructions: str | None,
        update_instructions: bool,
    ) -> Project:
        if name is not None:
            project.name = name
        if update_instructions:
            project.instructions = instructions
        await self.session.flush()
        await self.session.refresh(project)
        return project

    async def soft_delete(self, project: Project) -> None:
        project.deleted_at = datetime.now(UTC)
        await self.session.execute(
            update(Conversation)
            .where(Conversation.project_id == project.id, Conversation.deleted_at.is_(None))
            .values(project_id=None)
        )
        await self.session.flush()

    async def list_files(self, project_id: UUID, supervisor_id: UUID) -> list[File]:
        query: Select[tuple[File]] = (
            select(File)
            .join(MessageFile, MessageFile.file_id == File.id)
            .join(Conversation, Conversation.id == MessageFile.conversation_id)
            .where(
                Conversation.project_id == project_id,
                Conversation.supervisor_id == supervisor_id,
                Conversation.deleted_at.is_(None),
                MessageFile.deleted_at.is_(None),
                File.supervisor_id == supervisor_id,
                File.deleted_at.is_(None),
            )
            .distinct()
            .order_by(File.original_filename.asc())
        )
        return list(await self.session.scalars(query))
