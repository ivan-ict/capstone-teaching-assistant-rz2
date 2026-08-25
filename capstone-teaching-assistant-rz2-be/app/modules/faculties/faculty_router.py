from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_user
from app.common.database import get_db_session
from app.modules.faculties.faculty_model import FacultyListDTO
from app.modules.faculties.faculty_service import FacultyService

faculty_router = APIRouter(prefix="/faculties", tags=["Faculties"])
CurrentUserDependency = Annotated[CurrentUser, Depends(get_current_user)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]


@faculty_router.get("", response_model=FacultyListDTO)
async def list_faculties(
    _current_user: CurrentUserDependency,
    session: DatabaseSessionDependency,
):
    return await FacultyService(session).list_active()
