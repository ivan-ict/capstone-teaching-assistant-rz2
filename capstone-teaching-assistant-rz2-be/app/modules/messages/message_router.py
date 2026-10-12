from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_supervisor
from app.common.database import get_db_session
from app.modules.messages.message_model import (
    MessageCreateDTO,
    MessageCreateResponseDTO,
    MessageRetryResponseDTO,
)
from app.modules.messages.message_service import MessageService

message_router = APIRouter(tags=["Messages"])
CurrentSupervisorDependency = Annotated[CurrentUser, Depends(get_current_supervisor)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]


@message_router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageCreateResponseDTO,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    conversation_id: UUID,
    payload: MessageCreateDTO,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await MessageService(session).create_message_pair(
        current_user.id,
        conversation_id,
        payload.content,
    )


@message_router.get(
    "/messages/{message_id}/stream",
    response_class=StreamingResponse,
    responses={
        status.HTTP_200_OK: {
            "description": "Server-sent event stream.",
            "content": {"text/event-stream": {"schema": {"type": "string"}}},
        }
    },
)
async def stream_message(
    message_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    service = MessageService(session)
    generation_context = await service.prepare_assistant_stream(current_user.id, message_id)
    stream = service.stream_assistant_response(generation_context)
    return StreamingResponse(stream, media_type="text/event-stream")


@message_router.post("/messages/{message_id}/retry", response_model=MessageRetryResponseDTO)
async def retry_message(
    message_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await MessageService(session).retry_assistant_response(current_user.id, message_id)
