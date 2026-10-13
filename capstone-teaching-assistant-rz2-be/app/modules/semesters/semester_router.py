from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_admin
from app.common.config import get_settings
from app.common.database import get_db_session
from app.common.db_models import FileProcessingStatus
from app.common.errors import ApiError
from app.common.sorting import SortOrder
from app.modules.files.file_model import FileDTO, FileListDTO
from app.modules.files.file_service import FileService
from app.modules.semesters.semester_model import (
    SemesterAssignDTO,
    SemesterDTO,
    SemesterListDTO,
    SemesterSupervisorListDTO,
    SemesterWriteDTO,
)
from app.modules.semesters.semester_service import SemesterService

UPLOAD_READ_CHUNK_SIZE = 1024 * 1024

semester_router = APIRouter(prefix="/admin/semesters", tags=["Admin Semesters"])
Admin = Annotated[CurrentUser, Depends(get_current_admin)]
Session = Annotated[AsyncSession, Depends(get_db_session)]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str | None, Query(max_length=100)]
SemesterSort = Annotated[
    Literal["name", "year", "start_date", "file_count", "supervisor_count"] | None, Query()
]
SupervisorSort = Annotated[Literal["username", "name", "status", "semester"], Query()]
FileSort = Annotated[Literal["name", "type", "size", "status", "created_at"], Query()]


@semester_router.get("", response_model=SemesterListDTO)
async def list_semesters(
    admin: Admin,
    session: Session,
    search: Search = None,
    archived: bool = False,
    page: Page = 1,
    page_size: PageSize = 20,
    sort_by: SemesterSort = None,
    sort_order: SortOrder = "asc",
):
    return await SemesterService(session).list_semesters(
        search, archived, page, page_size, sort_by, sort_order
    )


@semester_router.post("", response_model=SemesterDTO, status_code=201)
async def create_semester(payload: SemesterWriteDTO, admin: Admin, session: Session):
    return await SemesterService(session).create(payload)


@semester_router.get("/{semester_id}", response_model=SemesterDTO)
async def get_semester(semester_id: UUID, admin: Admin, session: Session):
    service = SemesterService(session)
    return await service.detail(await service.get(semester_id))


@semester_router.patch("/{semester_id}", response_model=SemesterDTO)
async def update_semester(
    semester_id: UUID, payload: SemesterWriteDTO, admin: Admin, session: Session
):
    return await SemesterService(session).update(semester_id, payload)


@semester_router.delete("/{semester_id}", status_code=204)
async def archive_semester(semester_id: UUID, admin: Admin, session: Session):
    await SemesterService(session).archive(semester_id)
    return Response(status_code=204)


@semester_router.get("/{semester_id}/supervisors", response_model=SemesterSupervisorListDTO)
async def list_supervisors(
    semester_id: UUID,
    admin: Admin,
    session: Session,
    search: Search = None,
    page: Page = 1,
    page_size: PageSize = 20,
    sort_by: SupervisorSort = "username",
    sort_order: SortOrder = "asc",
):
    return await SemesterService(session).supervisors(
        semester_id, False, search, page, page_size, sort_by, sort_order
    )


@semester_router.get(
    "/{semester_id}/supervisor-candidates", response_model=SemesterSupervisorListDTO
)
async def list_candidates(
    semester_id: UUID,
    admin: Admin,
    session: Session,
    search: Search = None,
    page: Page = 1,
    page_size: PageSize = 20,
    sort_by: SupervisorSort = "username",
    sort_order: SortOrder = "asc",
):
    return await SemesterService(session).supervisors(
        semester_id, True, search, page, page_size, sort_by, sort_order
    )


@semester_router.post("/{semester_id}/supervisors")
async def assign_supervisors(
    semester_id: UUID, payload: SemesterAssignDTO, admin: Admin, session: Session
):
    return await SemesterService(session).assign(semester_id, payload.supervisor_ids)


@semester_router.get("/{semester_id}/files", response_model=FileListDTO)
async def list_files(
    semester_id: UUID,
    admin: Admin,
    session: Session,
    search: Search = None,
    processing_status: FileProcessingStatus | None = None,
    page: Page = 1,
    page_size: PageSize = 20,
    sort_by: FileSort = "created_at",
    sort_order: SortOrder = "desc",
):
    await SemesterService(session).get(semester_id)
    return await FileService(session).list_files(
        semester_id, search, processing_status, page, page_size, sort_by, sort_order
    )


@semester_router.post("/{semester_id}/files", response_model=FileDTO, status_code=201)
async def upload_file(
    semester_id: UUID, admin: Admin, session: Session, file: Annotated[UploadFile, File()]
):
    content = await _read_limited_upload(file, get_settings().max_upload_bytes)
    return await FileService(session).upload_file(
        semester_id, admin.id, file.filename or "upload.txt", content, file.content_type
    )


@semester_router.delete("/{semester_id}/files/{file_id}", status_code=204)
async def delete_file(semester_id: UUID, file_id: UUID, admin: Admin, session: Session):
    await FileService(session).delete_file(semester_id, file_id)
    return Response(status_code=204)


async def _read_limited_upload(file: UploadFile, max_upload_bytes: int) -> bytes:
    content = bytearray()
    while True:
        remaining = max_upload_bytes + 1 - len(content)
        chunk = await file.read(min(UPLOAD_READ_CHUNK_SIZE, remaining))
        if not chunk:
            return bytes(content)
        content.extend(chunk)
        if len(content) > max_upload_bytes:
            raise ApiError(
                "FILE_TOO_LARGE",
                f"Upload must be {max_upload_bytes} bytes or fewer.",
                status.HTTP_413_CONTENT_TOO_LARGE,
            )
