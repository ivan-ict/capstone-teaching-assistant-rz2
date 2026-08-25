from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import Faculty


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
