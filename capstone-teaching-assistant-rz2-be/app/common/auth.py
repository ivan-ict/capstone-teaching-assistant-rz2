from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import get_settings
from app.common.database import get_db_session
from app.common.db_models import AccountStatus, User, UserRole


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    role: str


async def get_current_supervisor(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CurrentUser:
    settings = get_settings()
    user = await session.get(User, settings.dev_supervisor_id)
    if user is None:
        session.add(
            User(
                id=settings.dev_supervisor_id,
                username="dev-supervisor",
                password_hash="not-used",
                role=UserRole.SUPERVISOR,
                status=AccountStatus.ACTIVE,
            )
        )
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
    return CurrentUser(id=settings.dev_supervisor_id, role="SUPERVISOR")
