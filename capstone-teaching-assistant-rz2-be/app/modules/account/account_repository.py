from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import Faculty, SupervisorProfile, User


class AccountRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user(self, user_id: UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def get_profile_with_faculty(
        self, user_id: UUID
    ) -> tuple[SupervisorProfile, Faculty] | None:
        query = (
            select(SupervisorProfile, Faculty)
            .join(Faculty, Faculty.id == SupervisorProfile.faculty_id)
            .where(
                SupervisorProfile.user_id == user_id,
                SupervisorProfile.deleted_at.is_(None),
                Faculty.is_active.is_(True),
                Faculty.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(query)
        row = result.one_or_none()
        return (row[0], row[1]) if row else None
