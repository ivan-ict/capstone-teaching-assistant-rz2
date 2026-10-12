from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_supervisor
from app.common.database import get_db_session
from app.modules.conversations.conversation_model import (
    ConversationCreateDTO,
    ConversationDTO,
    ConversationListDTO,
    ConversationMessageListDTO,
    ConversationRenameDTO,
)
from app.modules.conversations.conversation_service import ConversationService

conversation_router = APIRouter(prefix="/conversations", tags=["Conversations"])
CurrentSupervisorDependency = Annotated[CurrentUser, Depends(get_current_supervisor)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
SEARCH_MAX_LENGTH = 100


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
    )


@conversation_router.get("", response_model=ConversationListDTO)
async def list_conversations(
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 100,
):
    return await ConversationService(session).list_conversations(
        supervisor_id=current_user.id,
        page=page,
        page_size=page_size,
    )


@conversation_router.get("/search", response_model=ConversationListDTO)
async def search_conversations(
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
    query: Annotated[str, Query(min_length=1, max_length=SEARCH_MAX_LENGTH)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    return await ConversationService(session).list_conversations(
        supervisor_id=current_user.id,
        page=page,
        page_size=page_size,
        search=query,
    )


@conversation_router.get("/{conversation_id}", response_model=ConversationDTO)
async def get_conversation(
    conversation_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await ConversationService(session).get_conversation(current_user.id, conversation_id)


@conversation_router.patch("/{conversation_id}", response_model=ConversationDTO)
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
