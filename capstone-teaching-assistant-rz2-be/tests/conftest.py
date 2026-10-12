from collections.abc import AsyncIterator
from datetime import date
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.common.auth import CurrentUser, get_current_supervisor
from app.common.database import Base, get_db_session
from app.common.db_models import AccountStatus, Semester, User, UserRole
from app.common.email import EmailDeliveryError, EmailMessageData, get_email_sender
from app.common.rate_limit import password_reset_limiter
from app.main import app

DEV_SEMESTER_ID = UUID("33333333-3333-3333-3333-333333333333")
DEV_SUPERVISOR_ID = UUID("11111111-1111-1111-1111-111111111111")
OTHER_SUPERVISOR_ID = UUID("22222222-2222-2222-2222-222222222222")


class FakeEmailSender:
    def __init__(self) -> None:
        self.sent: list[EmailMessageData] = []
        self.fail = False

    async def send(self, message: EmailMessageData) -> None:
        if self.fail:
            raise EmailDeliveryError("SMTP unavailable")
        self.sent.append(message)


@pytest.fixture
def email_sender() -> FakeEmailSender:
    return FakeEmailSender()


@pytest.fixture(autouse=True)
def reset_password_reset_limiter() -> None:
    password_reset_limiter.reset()


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        session.add(
            Semester(
                id=DEV_SEMESTER_ID,
                name="Development semester",
                year=2020,
                start_date=date(2020, 1, 1),
                end_date=date(2020, 6, 30),
            )
        )
        session.add_all(
            [
                User(
                    id=DEV_SUPERVISOR_ID,
                    username="dev-supervisor",
                    password_hash="not-used",
                    role=UserRole.SUPERVISOR,
                    status=AccountStatus.ACTIVE,
                ),
                User(
                    id=OTHER_SUPERVISOR_ID,
                    username="other-supervisor",
                    password_hash="not-used",
                    role=UserRole.SUPERVISOR,
                    status=AccountStatus.ACTIVE,
                ),
            ]
        )
        await session.commit()
        yield session

    await engine.dispose()


@pytest.fixture
async def client(
    session: AsyncSession, email_sender: FakeEmailSender
) -> AsyncIterator[AsyncClient]:
    async def override_session() -> AsyncIterator[AsyncSession]:
        yield session

    async def override_supervisor() -> CurrentUser:
        return CurrentUser(
            id=DEV_SUPERVISOR_ID,
            username="dev-supervisor",
            role=UserRole.SUPERVISOR,
            status=AccountStatus.ACTIVE,
        )

    app.dependency_overrides[get_db_session] = override_session
    app.dependency_overrides[get_current_supervisor] = override_supervisor
    app.dependency_overrides[get_email_sender] = lambda: email_sender
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
async def assigned_profiles(session):
    from app.common.db_models import Faculty, SupervisorProfile

    faculty = Faculty(code="CHAT", name="Chat test faculty", is_active=True)
    session.add(faculty)
    await session.flush()
    for index, user_id in enumerate((DEV_SUPERVISOR_ID, OTHER_SUPERVISOR_ID)):
        session.add(
            SupervisorProfile(
                user_id=user_id,
                faculty_id=faculty.id,
                first_name="Test",
                last_name=str(index),
                email=f"chat{index}@example.com",
                semester_id=DEV_SEMESTER_ID,
            )
        )
    await session.commit()
