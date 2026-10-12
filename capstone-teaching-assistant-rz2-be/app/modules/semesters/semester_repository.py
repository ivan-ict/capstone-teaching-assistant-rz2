from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import (
    AccountStatus,
    File,
    FileProcessingStatus,
    Semester,
    SupervisorProfile,
    User,
    UserRole,
)


class SemesterRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, semester_id: UUID, lock: bool = False) -> Semester | None:
        query = select(Semester).where(Semester.id == semester_id)
        if lock:
            query = query.with_for_update()
        return await self.session.scalar(query.execution_options(populate_existing=True))

    async def current(self, supervisor_id: UUID, lock: bool = False) -> Semester | None:
        # Lock the profile first: transfers follow the same profile -> semester order.
        query = select(SupervisorProfile).where(
            SupervisorProfile.user_id == supervisor_id, SupervisorProfile.deleted_at.is_(None)
        )
        if lock:
            query = query.with_for_update()
        profile = await self.session.scalar(query.execution_options(populate_existing=True))
        return await self.get(profile.semester_id, lock) if profile else None

    async def create(self, values: dict) -> Semester:
        semester = Semester(**values)
        self.session.add(semester)
        await self.session.flush()
        return semester

    async def counts(self, semester_id: UUID) -> tuple[int, int, int]:
        files = (
            await self.session.scalar(
                select(func.count())
                .select_from(File)
                .where(File.semester_id == semester_id, File.deleted_at.is_(None))
            )
            or 0
        )
        ready = (
            await self.session.scalar(
                select(func.count())
                .select_from(File)
                .where(
                    File.semester_id == semester_id,
                    File.deleted_at.is_(None),
                    File.processing_status == FileProcessingStatus.READY,
                )
            )
            or 0
        )
        supervisors = (
            await self.session.scalar(
                select(func.count())
                .select_from(SupervisorProfile)
                .join(User, User.id == SupervisorProfile.user_id)
                .where(
                    SupervisorProfile.semester_id == semester_id,
                    SupervisorProfile.deleted_at.is_(None),
                    User.deleted_at.is_(None),
                )
            )
            or 0
        )
        return files, supervisors, ready

    async def list_semesters(self, search: str | None, archived: bool, page: int, page_size: int):
        query = select(Semester).where(
            Semester.deleted_at.is_not(None) if archived else Semester.deleted_at.is_(None)
        )
        if search:
            query = query.where(Semester.name.ilike(f"%{search}%"))
        total = await self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = list(
            await self.session.scalars(
                query.order_by(Semester.year.desc(), Semester.start_date.desc(), Semester.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        return items, total

    async def supervisors(
        self, semester_id: UUID, candidates: bool, search: str | None, page: int, page_size: int
    ):
        query = (
            select(User, SupervisorProfile)
            .join(SupervisorProfile, SupervisorProfile.user_id == User.id)
            .where(
                User.role == UserRole.SUPERVISOR,
                User.deleted_at.is_(None),
                SupervisorProfile.deleted_at.is_(None),
            )
        )
        if candidates:
            query = query.where(
                User.status == AccountStatus.ACTIVE, SupervisorProfile.semester_id != semester_id
            )
        else:
            query = query.where(SupervisorProfile.semester_id == semester_id)
        if search:
            query = query.where(
                or_(
                    User.username.ilike(f"%{search}%"),
                    SupervisorProfile.first_name.ilike(f"%{search}%"),
                    SupervisorProfile.last_name.ilike(f"%{search}%"),
                )
            )
        total = await self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = (
            await self.session.execute(
                query.order_by(User.username, User.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
        return rows, total

    async def lock_supervisors(self, ids: list[UUID]):
        query = (
            select(User, SupervisorProfile)
            .join(SupervisorProfile, SupervisorProfile.user_id == User.id)
            .where(User.id.in_(ids))
            .order_by(User.id)
            .with_for_update(of=(User, SupervisorProfile))
            .execution_options(populate_existing=True)
        )
        return (await self.session.execute(query)).all()
