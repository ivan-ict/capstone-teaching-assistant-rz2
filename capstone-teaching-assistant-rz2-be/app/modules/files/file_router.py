from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_user
from app.common.database import get_db_session
from app.modules.files.file_model import (
    FileContentDTO,
    FileDetailDTO,
)
from app.modules.files.file_service import FileService

file_router = APIRouter(prefix="/files", tags=["Files"])
CurrentUserDependency = Annotated[CurrentUser, Depends(get_current_user)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]


@file_router.get("/{file_id}", response_model=FileDetailDTO)
async def get_file(
    file_id: UUID,
    current_user: CurrentUserDependency,
    session: DatabaseSessionDependency,
):
    service = FileService(session)
    semester_id = await service.authorize_file(current_user, file_id)
    return await service.get_file(semester_id, file_id)


@file_router.get("/{file_id}/content", response_model=FileContentDTO)
async def get_file_content(
    file_id: UUID,
    current_user: CurrentUserDependency,
    session: DatabaseSessionDependency,
):
    service = FileService(session)
    semester_id = await service.authorize_file(current_user, file_id)
    return await service.get_content(semester_id, file_id)


@file_router.get(
    "/{file_id}/download",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_200_OK: {
            "description": "Stored file content.",
            "content": {"application/octet-stream": {}},
        }
    },
)
async def download_file(
    file_id: UUID,
    current_user: CurrentUserDependency,
    session: DatabaseSessionDependency,
):
    service = FileService(session)
    semester_id = await service.authorize_file(current_user, file_id)
    file, content = await service.download_file(semester_id, file_id)
    encoded_filename = quote(file.original_filename)
    return Response(
        content=content,
        media_type=file.mime_type,
        headers={"Content-Disposition": (f"attachment; filename*=UTF-8''{encoded_filename}")},
    )
