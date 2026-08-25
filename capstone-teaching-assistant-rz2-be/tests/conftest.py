from collections.abc import AsyncIterator
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.common.auth import CurrentUser, get_current_supervisor
from app.common.database import Base, get_db_session
from app.common.db_models import AccountStatus, User, UserRole
from app.main import app

DEV_SUPERVISOR_ID = UUID("11111111-1111-1111-1111-111111111111")
OTHER_SUPERVISOR_ID = UUID("22222222-2222-2222-2222-222222222222")


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
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
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
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as test_client:
        yield test_client
    app.dependency_overrides.clear()
