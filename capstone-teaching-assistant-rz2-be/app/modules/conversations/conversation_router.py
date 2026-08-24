from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_supervisor
from app.common.database import get_db_session
from app.common.errors import ApiError
from app.modules.conversations.conversation_model import (
    ConversationCreateDTO,
    ConversationDetailDTO,
    ConversationDTO,
    ConversationFileAssociateDTO,
    ConversationFileAssociationDTO,
    ConversationFileListDTO,
    ConversationListDTO,
    ConversationMessageListDTO,
    ConversationMoveProjectDTO,
    ConversationMoveProjectResponseDTO,
    ConversationRenameDTO,
    ConversationRenameResponseDTO,
)
from app.modules.conversations.conversation_service import ConversationService

conversation_router = APIRouter(prefix="/conversations", tags=["Conversations"])
CurrentSupervisorDependency = Annotated[CurrentUser, Depends(get_current_supervisor)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
ProjectFilterDependency = Annotated[str | None, Query()]


def _parse_project_filter(project_id: str | None) -> tuple[UUID | None, bool]:
    if project_id is None:
        return None, False
    if project_id == "unprojected":
        return None, True
    try:
        return UUID(project_id), False
    except ValueError as exc:
        raise ApiError(
            code="VALIDATION_ERROR",
            message="project_id must be a UUID or 'unprojected'.",
            http_status=status.HTTP_422_UNPROCESSABLE_CONTENT,
        ) from exc


@conversation_router.post(
    "",
    response_model=ConversationDTO,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ConversationCreateDTO,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ConversationService(session).create_conversation(
        supervisor_id=current_user.id,
        project_id=payload.project_id,
    )


@conversation_router.get("", response_model=ConversationListDTO)
async def list_conversations(
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
    project_id: ProjectFilterDependency = None,
):
    parsed_project_id, unprojected = _parse_project_filter(project_id)
    return await ConversationService(session).list_conversations(
        supervisor_id=current_user.id,
        project_id=parsed_project_id,
        unprojected=unprojected,
    )


@conversation_router.get("/{conversation_id}", response_model=ConversationDetailDTO)
async def get_conversation(
    conversation_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ConversationService(session).get_conversation(current_user.id, conversation_id)


@conversation_router.patch("/{conversation_id}", response_model=ConversationRenameResponseDTO)
async def rename_conversation(
    conversation_id: UUID,
    payload: ConversationRenameDTO,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ConversationService(session).rename_conversation(
        current_user.id,
        conversation_id,
        payload.title,
    )


@conversation_router.patch(
    "/{conversation_id}/project",
    response_model=ConversationMoveProjectResponseDTO,
)
async def move_conversation_to_project(
    conversation_id: UUID,
    payload: ConversationMoveProjectDTO,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ConversationService(session).move_conversation_to_project(
        current_user.id,
        conversation_id,
        payload.project_id,
    )


@conversation_router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    await ConversationService(session).delete_conversation(current_user.id, conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@conversation_router.get(
    "/{conversation_id}/messages",
    response_model=ConversationMessageListDTO,
)
async def list_conversation_messages(
    conversation_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ConversationService(session).list_messages(current_user.id, conversation_id)


@conversation_router.get("/{conversation_id}/files", response_model=ConversationFileListDTO)
async def list_conversation_files(
    conversation_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ConversationService(session).list_files(current_user.id, conversation_id)


@conversation_router.post(
    "/{conversation_id}/files",
    response_model=ConversationFileAssociationDTO,
)
async def associate_conversation_files(
    conversation_id: UUID,
    payload: ConversationFileAssociateDTO,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ConversationService(session).associate_files(
        current_user.id,
        conversation_id,
        payload.file_ids,
    )
