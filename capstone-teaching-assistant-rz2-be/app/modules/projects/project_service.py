from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import NotFoundError
from app.modules.projects.project_model import (
    ProjectCreateDTO,
    ProjectDTO,
    ProjectFileDTO,
    ProjectFileListDTO,
    ProjectListDTO,
    ProjectListItemDTO,
    ProjectUpdateDTO,
    ProjectUpdateResponseDTO,
)
from app.modules.projects.project_repository import ProjectRepository


class ProjectService:
    def __init__(
        self,
        session: AsyncSession,
        repository: ProjectRepository | None = None,
    ) -> None:
        self.session = session
        self.repository = repository or ProjectRepository(session)

    async def create_project(self, supervisor_id: UUID, payload: ProjectCreateDTO) -> ProjectDTO:
        project = await self.repository.create(supervisor_id, payload.name, payload.instructions)
        await self.session.commit()
        return ProjectDTO.model_validate(project)

    async def list_projects(self, supervisor_id: UUID) -> ProjectListDTO:
        projects = await self.repository.list_for_supervisor(supervisor_id)
        return ProjectListDTO(
            items=[
                ProjectListItemDTO(
                    id=project.id,
                    name=project.name,
                    instructions=project.instructions,
                    updated_at=project.updated_at,
                )
                for project in projects
            ]
        )

    async def get_project(self, supervisor_id: UUID, project_id: UUID) -> ProjectDTO:
        project = await self._get_project(supervisor_id, project_id)
        return ProjectDTO.model_validate(project)

    async def update_project(
        self, supervisor_id: UUID, project_id: UUID, payload: ProjectUpdateDTO
    ) -> ProjectUpdateResponseDTO:
        project = await self._get_project(supervisor_id, project_id)
        project = await self.repository.update(
            project,
            payload.name,
            payload.instructions,
            "instructions" in payload.model_fields_set,
        )
        await self.session.commit()
        return ProjectUpdateResponseDTO(
            id=project.id,
            name=project.name,
            instructions=project.instructions,
        )

    async def delete_project(self, supervisor_id: UUID, project_id: UUID) -> None:
        project = await self._get_project(supervisor_id, project_id)
        await self.repository.soft_delete(project)
        await self.session.commit()

    async def list_files(self, supervisor_id: UUID, project_id: UUID) -> ProjectFileListDTO:
        await self._get_project(supervisor_id, project_id)
        files = await self.repository.list_files(project_id, supervisor_id)
        return ProjectFileListDTO(
            items=[
                ProjectFileDTO(
                    id=file.id,
                    original_filename=file.original_filename,
                    mime_type=file.mime_type,
                    file_size_bytes=file.file_size_bytes,
                    processing_status=file.processing_status,
                )
                for file in files
            ]
        )

    async def _get_project(self, supervisor_id: UUID, project_id: UUID):
        project = await self.repository.get_for_supervisor(project_id, supervisor_id)
        if project is None:
            raise NotFoundError("Project not found.")
        return project
