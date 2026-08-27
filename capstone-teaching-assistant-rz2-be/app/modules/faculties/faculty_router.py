from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_admin, get_current_user
from app.common.database import get_db_session
from app.modules.faculties.faculty_model import (
    AdminFacultyDTO,
    AdminFacultyListDTO,
    FacultyCreateDTO,
    FacultyListDTO,
    FacultyUpdateDTO,
)
from app.modules.faculties.faculty_service import FacultyService

faculty_router = APIRouter(prefix="/faculties", tags=["Faculties"])
admin_faculty_router = APIRouter(prefix="/admin/faculties", tags=["Admin Faculties"])
CurrentUserDependency = Annotated[CurrentUser, Depends(get_current_user)]
CurrentAdminDependency = Annotated[CurrentUser, Depends(get_current_admin)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
SEARCH_MAX_LENGTH = 100


@faculty_router.get("", response_model=FacultyListDTO)
async def list_faculties(
    _current_user: CurrentUserDependency,
    session: DatabaseSessionDependency,
):
    return await FacultyService(session).list_active()


@admin_faculty_router.get("", response_model=AdminFacultyListDTO)
async def list_admin_faculties(
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
    search: Annotated[str | None, Query(max_length=SEARCH_MAX_LENGTH)] = None,
    include_inactive: Annotated[bool, Query()] = True,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    return await FacultyService(session).list_admin(search, include_inactive, page, page_size)


@admin_faculty_router.post(
    "",
    response_model=AdminFacultyDTO,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin_faculty(
    payload: FacultyCreateDTO,
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
):
    return await FacultyService(session).create(payload)


@admin_faculty_router.patch("/{faculty_id}", response_model=AdminFacultyDTO)
async def update_admin_faculty(
    faculty_id: UUID,
    payload: FacultyUpdateDTO,
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
):
    return await FacultyService(session).update(faculty_id, payload)


@admin_faculty_router.delete("/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_faculty(
    faculty_id: UUID,
    _current_admin: CurrentAdminDependency,
    session: DatabaseSessionDependency,
):
    await FacultyService(session).delete(faculty_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
