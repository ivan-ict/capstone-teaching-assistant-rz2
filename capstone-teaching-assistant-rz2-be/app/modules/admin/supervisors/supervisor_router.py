from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_admin
from app.common.database import get_db_session
from app.common.db_models import AccountStatus
from app.common.email import EmailSender, get_email_sender
from app.modules.admin.supervisors.supervisor_model import (
    SupervisorCreateDTO,
    SupervisorCreateResponseDTO,
    SupervisorDetailDTO,
    SupervisorListDTO,
    SupervisorPasswordResetResponseDTO,
    SupervisorStatusResponseDTO,
    SupervisorStatusUpdateDTO,
    SupervisorUpdateDTO,
    SupervisorUpdateResponseDTO,
)
from app.modules.admin.supervisors.supervisor_service import SupervisorService

supervisor_router = APIRouter(prefix="/admin/supervisors", tags=["Admin Supervisors"])
CurrentAdminDependency = Annotated[CurrentUser, Depends(get_current_admin)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
EmailSenderDependency = Annotated[EmailSender, Depends(get_email_sender)]
SEARCH_MAX_LENGTH = 100


@supervisor_router.post(
    "",
    response_model=SupervisorCreateResponseDTO,
    status_code=status.HTTP_201_CREATED,
)
async def create_supervisor(
    payload: SupervisorCreateDTO,
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
    email_sender: EmailSenderDependency,
):
    return await SupervisorService(session).create_supervisor(payload, email_sender)


@supervisor_router.get("", response_model=SupervisorListDTO)
async def list_supervisors(
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
    search: Annotated[str | None, Query(max_length=SEARCH_MAX_LENGTH)] = None,
    faculty_id: Annotated[UUID | None, Query()] = None,
    status_filter: Annotated[AccountStatus | None, Query(alias="status")] = None,
    semester_id: Annotated[UUID | None, Query()] = None,
    sort_by: Annotated[str, Query()] = "created_at",
    sort_order: Annotated[str, Query()] = "desc",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    return await SupervisorService(session).list_supervisors(
        search,
        faculty_id,
        status_filter,
        semester_id,
        sort_by,
        sort_order,
        page,
        page_size,
    )


@supervisor_router.get("/{supervisor_id}", response_model=SupervisorDetailDTO)
async def get_supervisor(
    supervisor_id: UUID,
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
):
    return await SupervisorService(session).get_supervisor(supervisor_id)


@supervisor_router.patch("/{supervisor_id}", response_model=SupervisorUpdateResponseDTO)
async def update_supervisor(
    supervisor_id: UUID,
    payload: SupervisorUpdateDTO,
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
):
    return await SupervisorService(session).update_supervisor(supervisor_id, payload)


@supervisor_router.patch("/{supervisor_id}/status", response_model=SupervisorStatusResponseDTO)
async def update_supervisor_status(
    supervisor_id: UUID,
    payload: SupervisorStatusUpdateDTO,
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
):
    return await SupervisorService(session).update_status(supervisor_id, payload.status)


@supervisor_router.post(
    "/{supervisor_id}/password-reset",
    response_model=SupervisorPasswordResetResponseDTO,
)
async def reset_supervisor_password(
    supervisor_id: UUID,
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
    email_sender: EmailSenderDependency,
):
    return await SupervisorService(session).reset_password(supervisor_id, email_sender)


@supervisor_router.delete("/{supervisor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supervisor(
    supervisor_id: UUID,
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
):
    await SupervisorService(session).soft_delete_supervisor(supervisor_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
