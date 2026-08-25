from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_supervisor
from app.common.database import get_db_session
from app.modules.projects.project_model import (
    ProjectCreateDTO,
    ProjectDTO,
    ProjectFileListDTO,
    ProjectListDTO,
    ProjectUpdateDTO,
    ProjectUpdateResponseDTO,
)
from app.modules.projects.project_service import ProjectService

project_router = APIRouter(prefix="/projects", tags=["Projects"])
CurrentSupervisorDependency = Annotated[CurrentUser, Depends(get_current_supervisor)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]


@project_router.post("", response_model=ProjectDTO, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreateDTO,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ProjectService(session).create_project(current_user.id, payload)


@project_router.get("", response_model=ProjectListDTO)
async def list_projects(
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ProjectService(session).list_projects(current_user.id)


@project_router.get("/{project_id}", response_model=ProjectDTO)
async def get_project(
    project_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ProjectService(session).get_project(current_user.id, project_id)


@project_router.patch("/{project_id}", response_model=ProjectUpdateResponseDTO)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdateDTO,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ProjectService(session).update_project(current_user.id, project_id, payload)


@project_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    await ProjectService(session).delete_project(current_user.id, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@project_router.get("/{project_id}/files", response_model=ProjectFileListDTO)
async def list_project_files(
    project_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ProjectService(session).list_files(current_user.id, project_id)
