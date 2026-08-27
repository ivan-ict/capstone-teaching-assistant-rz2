from uuid import UUID

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import ApiError, NotFoundError
from app.modules.faculties.faculty_model import (
    AdminFacultyDTO,
    AdminFacultyListDTO,
    FacultyCreateDTO,
    FacultyDTO,
    FacultyListDTO,
    FacultyUpdateDTO,
)
from app.modules.faculties.faculty_repository import FacultyRepository


class FacultyService:
    def __init__(self, session: AsyncSession, repository: FacultyRepository | None = None) -> None:
        self.session = session
        self.repository = repository or FacultyRepository(session)

    async def list_active(self) -> FacultyListDTO:
        faculties = await self.repository.list_active()
        return FacultyListDTO(
            items=[
                FacultyDTO(id=faculty.id, code=faculty.code, name=faculty.name)
                for faculty in faculties
            ]
        )

    async def list_admin(
        self,
        search: str | None,
        include_inactive: bool,
        page: int,
        page_size: int,
    ) -> AdminFacultyListDTO:
        rows, total = await self.repository.list_admin(search, include_inactive, page, page_size)
        return AdminFacultyListDTO(
            items=[
                AdminFacultyDTO(
                    id=faculty.id,
                    code=faculty.code,
                    name=faculty.name,
                    is_active=faculty.is_active,
                    supervisor_count=supervisor_count,
                    created_at=faculty.created_at,
                    updated_at=faculty.updated_at,
                )
                for faculty, supervisor_count in rows
            ],
            page=page,
            page_size=page_size,
            total=total,
        )

    async def create(self, payload: FacultyCreateDTO) -> AdminFacultyDTO:
        try:
            faculty = await self.repository.create(payload.code, payload.name)
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._duplicate_error(exc) from exc
        return AdminFacultyDTO(
            id=faculty.id,
            code=faculty.code,
            name=faculty.name,
            is_active=faculty.is_active,
            supervisor_count=0,
            created_at=faculty.created_at,
            updated_at=faculty.updated_at,
        )

    async def update(self, faculty_id: UUID, payload: FacultyUpdateDTO) -> AdminFacultyDTO:
        if not payload.model_fields_set:
            raise ApiError("VALIDATION_ERROR", "At least one field must be provided.")
        faculty = await self._get(faculty_id)
        if payload.code is not None:
            faculty.code = payload.code
        if payload.name is not None:
            faculty.name = payload.name
        if payload.is_active is not None:
            faculty.is_active = payload.is_active
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._duplicate_error(exc) from exc
        supervisor_count = await self.repository.supervisor_count(faculty.id)
        return AdminFacultyDTO(
            id=faculty.id,
            code=faculty.code,
            name=faculty.name,
            is_active=faculty.is_active,
            supervisor_count=supervisor_count,
            created_at=faculty.created_at,
            updated_at=faculty.updated_at,
        )

    async def delete(self, faculty_id: UUID) -> None:
        faculty = await self._get(faculty_id)
        supervisor_count = await self.repository.supervisor_count(faculty.id)
        if supervisor_count > 0:
            raise ApiError(
                "FACULTY_HAS_SUPERVISORS",
                "Faculty cannot be deleted while supervisors are assigned.",
                status.HTTP_409_CONFLICT,
            )
        await self.repository.soft_delete(faculty)
        await self.session.commit()

    async def _get(self, faculty_id: UUID):
        faculty = await self.repository.get(faculty_id)
        if faculty is None:
            raise NotFoundError("Faculty not found.")
        return faculty

    def _duplicate_error(self, exc: IntegrityError) -> ApiError:
        message = str(exc.orig).lower()
        if "code" in message:
            return ApiError("DUPLICATE_FACULTY_CODE", "Faculty code already exists.", status.HTTP_409_CONFLICT)
        if "name" in message:
            return ApiError("DUPLICATE_FACULTY_NAME", "Faculty name already exists.", status.HTTP_409_CONFLICT)
        return ApiError("FACULTY_CONFLICT", "Faculty conflicts with existing data.", status.HTTP_409_CONFLICT)
