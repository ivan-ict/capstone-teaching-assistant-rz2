from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import Faculty, SupervisorProfile


class FacultyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_active(self) -> list[Faculty]:
        query = (
            select(Faculty)
            .where(Faculty.is_active.is_(True), Faculty.deleted_at.is_(None))
            .order_by(Faculty.name.asc())
        )
        return list(await self.session.scalars(query))

    async def list_admin(
        self,
        search: str | None,
        include_inactive: bool,
        page: int,
        page_size: int,
    ) -> tuple[list[tuple[Faculty, int]], int]:
        filters = [Faculty.deleted_at.is_(None)]
        if not include_inactive:
            filters.append(Faculty.is_active.is_(True))
        if search:
            search_filter = f"%{search}%"
            filters.append(
                or_(Faculty.name.ilike(search_filter), Faculty.code.ilike(search_filter))
            )
        total = (
            await self.session.scalar(select(func.count()).select_from(Faculty).where(*filters))
            or 0
        )
        query = (
            select(Faculty, func.count(SupervisorProfile.id))
            .outerjoin(
                SupervisorProfile,
                (SupervisorProfile.faculty_id == Faculty.id)
                & (SupervisorProfile.deleted_at.is_(None)),
            )
            .where(*filters)
            .group_by(Faculty.id)
            .order_by(Faculty.name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.session.execute(query)).all()
        return [(row[0], row[1]) for row in rows], total

    async def get(self, faculty_id: UUID) -> Faculty | None:
        query = select(Faculty).where(Faculty.id == faculty_id, Faculty.deleted_at.is_(None))
        return await self.session.scalar(query)

    async def supervisor_count(self, faculty_id: UUID) -> int:
        query = (
            select(func.count())
            .select_from(SupervisorProfile)
            .where(
                SupervisorProfile.faculty_id == faculty_id,
                SupervisorProfile.deleted_at.is_(None),
            )
        )
        return await self.session.scalar(query) or 0

    async def create(self, code: str, name: str) -> Faculty:
        faculty = Faculty(code=code, name=name, is_active=True)
        self.session.add(faculty)
        await self.session.flush()
        await self.session.refresh(faculty)
        return faculty

    async def soft_delete(self, faculty: Faculty) -> None:
        faculty.deleted_at = datetime.now(UTC)
        faculty.is_active = False
        await self.session.flush()
