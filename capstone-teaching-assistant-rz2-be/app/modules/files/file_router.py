from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_supervisor
from app.common.database import get_db_session
from app.common.db_models import FileProcessingStatus
from app.modules.files.file_model import FileDetailDTO, FileDTO, FileListDTO
from app.modules.files.file_service import FileService

file_router = APIRouter(prefix="/files", tags=["Files"])
CurrentSupervisorDependency = Annotated[CurrentUser, Depends(get_current_supervisor)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]


@file_router.post("", response_model=FileDTO, status_code=status.HTTP_201_CREATED)
async def upload_file(
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
    file: Annotated[UploadFile, File()],
):
    content = await file.read()
    return await FileService(session).upload_text_file(
        supervisor_id=current_user.id,
        original_filename=file.filename or "upload.txt",
        content=content,
        mime_type=file.content_type,
    )


@file_router.get("", response_model=FileListDTO)
async def list_files(
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
    search: Annotated[str | None, Query()] = None,
    processing_status: Annotated[FileProcessingStatus | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    return await FileService(session).list_files(
        supervisor_id=current_user.id,
        search=search,
        processing_status=processing_status,
        page=page,
        page_size=page_size,
    )


@file_router.get("/{file_id}", response_model=FileDetailDTO)
async def get_file(
    file_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    return await FileService(session).get_file(current_user.id, file_id)


@file_router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    await FileService(session).delete_file(current_user.id, file_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@file_router.get("/{file_id}/download", status_code=status.HTTP_302_FOUND)
async def download_file(
    file_id: UUID,
    current_user: CurrentSupervisorDependency,
    session: DatabaseSessionDependency,
):
    url = await FileService(session).get_download_url(current_user.id, file_id)
    return RedirectResponse(url)
