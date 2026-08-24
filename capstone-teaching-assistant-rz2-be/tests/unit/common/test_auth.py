import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import get_current_supervisor
from app.common.db_models import User, UserRole
from tests.conftest import DEV_SUPERVISOR_ID


@pytest.mark.asyncio
async def test_get_current_supervisor_seeds_missing_dev_user(session: AsyncSession) -> None:
    existing_user = await session.get(User, DEV_SUPERVISOR_ID)
    assert existing_user is not None
    await session.delete(existing_user)
    await session.commit()

    current_user = await get_current_supervisor(session)

    seeded_user = await session.get(User, DEV_SUPERVISOR_ID)
    assert current_user.id == DEV_SUPERVISOR_ID
    assert seeded_user is not None
    assert seeded_user.role == UserRole.SUPERVISOR
