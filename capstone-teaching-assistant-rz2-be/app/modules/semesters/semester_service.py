from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import AccountStatus, Semester, UserRole
from app.common.errors import ApiError, NotFoundError
from app.modules.semesters.semester_model import (
    SemesterDTO,
    SemesterListDTO,
    SemesterSummaryDTO,
    SemesterSupervisorDTO,
    SemesterSupervisorListDTO,
    SemesterWriteDTO,
)
from app.modules.semesters.semester_repository import SemesterRepository


class SemesterService:
    def __init__(self, session: AsyncSession, repository: SemesterRepository | None = None):
        self.session = session
        self.repository = repository or SemesterRepository(session)

    @staticmethod
    def ensure_active(semester: Semester) -> None:
        if semester.deleted_at is not None:
            raise ApiError("SEMESTER_ARCHIVED", "This semester is archived and read-only.", 409)

    async def get(self, semester_id: UUID, writable: bool = False) -> Semester:
        semester = await self.repository.get(semester_id, lock=writable)
        if semester is None:
            raise NotFoundError("Semester not found.")
        if writable:
            self.ensure_active(semester)
        return semester

    async def current(
        self, supervisor_id: UUID, writable: bool = False, lock: bool = False
    ) -> Semester:
        semester = await self.repository.current(supervisor_id, lock=writable or lock)
        if semester is None:
            raise ApiError("SEMESTER_REQUIRED", "A semester assignment is required.", 409)
        if writable:
            self.ensure_active(semester)
        return semester

    async def detail(self, semester: Semester) -> SemesterDTO:
        files, supervisors, ready = await self.repository.counts(semester.id)
        return SemesterDTO.model_validate(semester).model_copy(
            update={"file_count": files, "supervisor_count": supervisors, "ready_file_count": ready}
        )

    async def list_semesters(
        self, search: str | None, archived: bool, page: int, page_size: int
    ) -> SemesterListDTO:
        semesters, total = await self.repository.list_semesters(search, archived, page, page_size)
        return SemesterListDTO(
            items=[await self.detail(s) for s in semesters],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def create(self, payload: SemesterWriteDTO) -> SemesterDTO:
        semester = await self.repository.create(payload.model_dump())
        await self.session.commit()
        return await self.detail(semester)

    async def update(self, semester_id: UUID, payload: SemesterWriteDTO) -> SemesterDTO:
        semester = await self.get(semester_id, writable=True)
        for key, value in payload.model_dump().items():
            setattr(semester, key, value)
        await self.session.commit()
        return await self.detail(semester)

    async def archive(self, semester_id: UUID) -> None:
        semester = await self.get(semester_id, writable=True)
        semester.deleted_at = datetime.now(UTC)
        await self.session.commit()

    async def supervisors(
        self, semester_id: UUID, candidates: bool, search: str | None, page: int, page_size: int
    ) -> SemesterSupervisorListDTO:
        await self.get(semester_id)
        rows, total = await self.repository.supervisors(
            semester_id, candidates, search, page, page_size
        )
        return SemesterSupervisorListDTO(
            items=[
                SemesterSupervisorDTO(
                    id=user.id,
                    username=user.username,
                    first_name=profile.first_name,
                    last_name=profile.last_name,
                    status=user.status,
                    semester=SemesterSummaryDTO.model_validate(profile.semester),
                )
                for user, profile in rows
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def assign(self, semester_id: UUID, ids: list[UUID]) -> dict[str, int]:
        unique_ids = set(ids)
        rows = await self.repository.lock_supervisors(list(unique_ids))
        await self.get(semester_id, writable=True)
        if len(rows) != len(unique_ids) or any(
            user.role != UserRole.SUPERVISOR
            or user.status != AccountStatus.ACTIVE
            or user.deleted_at is not None
            or profile.deleted_at is not None
            or profile.semester_id == semester_id
            for user, profile in rows
        ):
            raise ApiError(
                "SUPERVISOR_NOT_ELIGIBLE",
                "The selection changed. Refresh and select active supervisors "
                "outside this semester.",
                409,
            )
        for _, profile in rows:
            profile.semester_id = semester_id
        await self.session.commit()
        return {"moved_count": len(rows)}
