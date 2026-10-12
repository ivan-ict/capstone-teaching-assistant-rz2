from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import AccountStatus, Faculty, SupervisorProfile, User, UserRole
from app.common.security import hash_password
from app.modules.admin.supervisors.supervisor_repository import SupervisorRepository
from tests.conftest import DEV_SEMESTER_ID


@pytest.mark.asyncio
async def test_create_user_and_profile_flushes_user_before_profile(session: AsyncSession) -> None:
    faculty = Faculty(code="SCI", name="School of Science", is_active=True)
    session.add(faculty)
    await session.flush()

    user_id = uuid4()
    user = User(
        id=user_id,
        username="testtesttest",
        password_hash=hash_password("Password123"),
        role=UserRole.SUPERVISOR,
        status=AccountStatus.ACTIVE,
    )
    profile = SupervisorProfile(
        semester_id=DEV_SEMESTER_ID,
        user_id=user_id,
        faculty_id=faculty.id,
        first_name="Test",
        last_name="User",
        email="testser@gmail.com",
    )

    created_user, created_profile = await SupervisorRepository(session).create_user_and_profile(
        user,
        profile,
    )

    assert created_user.id == user_id
    assert created_profile.user_id == user_id
