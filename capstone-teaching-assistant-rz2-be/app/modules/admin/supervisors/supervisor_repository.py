from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import AccountStatus, Faculty, SupervisorProfile, User, UserRole


class SupervisorRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def faculty_exists(self, faculty_id: UUID) -> bool:
        query = select(Faculty.id).where(
            Faculty.id == faculty_id,
            Faculty.is_active.is_(True),
            Faculty.deleted_at.is_(None),
        )
        return await self.session.scalar(query) is not None

    async def username_exists(self, username: str) -> bool:
        query = select(User.id).where(User.username == username, User.deleted_at.is_(None))
        return await self.session.scalar(query) is not None

    async def email_exists(self, email: str, exclude_user_id: UUID | None = None) -> bool:
        normalized_email = email.lower()
        query = select(SupervisorProfile.user_id).where(
            func.lower(SupervisorProfile.email) == normalized_email,
            SupervisorProfile.deleted_at.is_(None),
        )
        if exclude_user_id is not None:
            query = query.where(SupervisorProfile.user_id != exclude_user_id)
        return await self.session.scalar(query) is not None

    async def create_user_and_profile(
        self,
        user: User,
        profile: SupervisorProfile,
    ) -> tuple[User, SupervisorProfile]:
        self.session.add(user)
        await self.session.flush()
        self.session.add(profile)
        await self.session.flush()
        await self.session.refresh(user)
        await self.session.refresh(profile)
        return user, profile

    async def list_supervisors(
        self,
        search: str | None,
        faculty_id: UUID | None,
        status: AccountStatus | None,
        page: int,
        page_size: int,
    ) -> tuple[list[tuple[User, SupervisorProfile, Faculty]], int]:
        filters = [
            User.role == UserRole.SUPERVISOR,
            User.deleted_at.is_(None),
            SupervisorProfile.deleted_at.is_(None),
            Faculty.deleted_at.is_(None),
        ]
        if search:
            search_filter = f"%{search}%"
            filters.append(
                or_(
                    User.username.ilike(search_filter),
                    SupervisorProfile.first_name.ilike(search_filter),
                    SupervisorProfile.last_name.ilike(search_filter),
                    SupervisorProfile.email.ilike(search_filter),
                )
            )
        if faculty_id:
            filters.append(SupervisorProfile.faculty_id == faculty_id)
        if status:
            filters.append(User.status == status)

        base_query = (
            select(User, SupervisorProfile, Faculty)
            .join(SupervisorProfile, SupervisorProfile.user_id == User.id)
            .join(Faculty, Faculty.id == SupervisorProfile.faculty_id)
            .where(*filters)
        )
        total_query = select(func.count()).select_from(base_query.subquery())
        total = await self.session.scalar(total_query) or 0
        rows = list(
            (
                await self.session.execute(
                    base_query.order_by(SupervisorProfile.last_name.asc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return [(row[0], row[1], row[2]) for row in rows], total

    async def get_supervisor(
        self, supervisor_id: UUID
    ) -> tuple[User, SupervisorProfile, Faculty] | None:
        query = (
            select(User, SupervisorProfile, Faculty)
            .join(SupervisorProfile, SupervisorProfile.user_id == User.id)
            .join(Faculty, Faculty.id == SupervisorProfile.faculty_id)
            .where(
                User.id == supervisor_id,
                User.role == UserRole.SUPERVISOR,
                User.deleted_at.is_(None),
                SupervisorProfile.deleted_at.is_(None),
                Faculty.deleted_at.is_(None),
            )
        )
        row = (await self.session.execute(query)).one_or_none()
        return (row[0], row[1], row[2]) if row else None
