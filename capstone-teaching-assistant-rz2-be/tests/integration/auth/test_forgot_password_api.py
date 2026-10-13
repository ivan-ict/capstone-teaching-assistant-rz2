import re

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import get_settings
from app.common.db_models import AccountStatus, Faculty, SupervisorProfile, User, UserRole
from app.common.security import hash_password
from app.modules.auth.auth_service import FORGOT_PASSWORD_MESSAGE
from tests.conftest import DEV_SEMESTER_ID, FakeEmailSender

PASSWORD_PATTERN = re.compile(r"^Password: (\S+)$", re.MULTILINE)


async def add_supervisor(
    session: AsyncSession, status: AccountStatus = AccountStatus.ACTIVE
) -> User:
    faculty = Faculty(code="SCI", name="School of Science", is_active=True)
    user = User(
        username="rzhou",
        password_hash=hash_password("Password123"),
        role=UserRole.SUPERVISOR,
        status=status,
    )
    session.add_all([faculty, user])
    await session.flush()
    session.add(
        SupervisorProfile(
            semester_id=DEV_SEMESTER_ID,
            user_id=user.id,
            faculty_id=faculty.id,
            first_name="Rui",
            last_name="Zhou",
            email="rzhou@example.edu.au",
        )
    )
    await session.commit()
    return user


async def forgot(client: AsyncClient, identifier: str):
    return await client.post("/api/v1/auth/forgot-password", json={"identifier": identifier})


async def login(client: AsyncClient, password: str) -> int:
    response = await client.post(
        "/api/v1/auth/login", json={"username": "rzhou", "password": password}
    )
    return response.status_code


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "identifier", ["rzhou", "RZhou", "RZhou@Example.edu.au", "  rzhou@example.edu.au "]
)
async def test_forgot_password_replaces_and_emails_password(
    client: AsyncClient,
    session: AsyncSession,
    email_sender: FakeEmailSender,
    identifier: str,
) -> None:
    await add_supervisor(session)

    response = await forgot(client, identifier)

    assert response.status_code == 202
    assert response.json()["message"] == FORGOT_PASSWORD_MESSAGE
    assert len(email_sender.sent) == 1
    assert email_sender.sent[0].to == "rzhou@example.edu.au"
    match = PASSWORD_PATTERN.search(email_sender.sent[0].text)
    assert match is not None
    assert await login(client, "Password123") == 401
    assert await login(client, match.group(1)) == 200


@pytest.mark.asyncio
async def test_forgot_password_reports_unknown_account_without_sending(
    client: AsyncClient, session: AsyncSession, email_sender: FakeEmailSender
) -> None:
    session.add(
        User(
            username="admin",
            password_hash=hash_password("AdminPassword123!"),
            role=UserRole.ADMIN,
            status=AccountStatus.ACTIVE,
        )
    )
    await session.commit()

    for identifier in ("unknown-user", "nobody@example.edu.au", "admin"):
        response = await forgot(client, identifier)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "ACCOUNT_NOT_FOUND"

    assert email_sender.sent == []


@pytest.mark.asyncio
async def test_forgot_password_rejects_inactive_supervisor(
    client: AsyncClient, session: AsyncSession, email_sender: FakeEmailSender
) -> None:
    await add_supervisor(session, AccountStatus.INACTIVE)

    response = await forgot(client, "rzhou")

    assert response.status_code == 403
    assert email_sender.sent == []


@pytest.mark.asyncio
async def test_forgot_password_cooldown_limits_repeat_requests(
    client: AsyncClient, session: AsyncSession, email_sender: FakeEmailSender
) -> None:
    await add_supervisor(session)

    first = await forgot(client, "rzhou")
    second = await forgot(client, "rzhou@example.edu.au")

    assert first.status_code == 202
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "RESET_COOLDOWN"
    assert len(email_sender.sent) == 1


@pytest.mark.asyncio
async def test_forgot_password_limits_requests_per_ip(
    client: AsyncClient, session: AsyncSession, email_sender: FakeEmailSender
) -> None:
    await add_supervisor(session)

    for _ in range(get_settings().password_reset_ip_limit):
        await forgot(client, "unknown-user")
    response = await forgot(client, "rzhou")

    assert response.status_code == 429
    assert email_sender.sent == []


@pytest.mark.asyncio
async def test_forgot_password_keeps_old_password_when_email_fails(
    client: AsyncClient, session: AsyncSession, email_sender: FakeEmailSender
) -> None:
    await add_supervisor(session)
    email_sender.fail = True

    response = await forgot(client, "rzhou")

    assert response.status_code == 502
    assert await login(client, "Password123") == 200
