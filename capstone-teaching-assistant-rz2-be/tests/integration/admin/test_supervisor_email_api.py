import re

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import AccountStatus, Faculty, SupervisorProfile, User, UserRole
from app.common.security import hash_password
from tests.conftest import DEV_SEMESTER_ID, FakeEmailSender

PASSWORD_PATTERN = re.compile(r"^Password: (\S+)$", re.MULTILINE)


def extract_password(text: str) -> str:
    match = PASSWORD_PATTERN.search(text)
    assert match is not None
    return match.group(1)


async def login(client: AsyncClient, username: str, password: str) -> int:
    response = await client.post(
        "/api/v1/auth/login", json={"username": username, "password": password}
    )
    return response.status_code


@pytest.fixture
async def admin_headers(client: AsyncClient, session: AsyncSession) -> dict[str, str]:
    session.add_all(
        [
            Faculty(code="SCI", name="School of Science", is_active=True),
            User(
                username="admin",
                password_hash=hash_password("AdminPassword123!"),
                role=UserRole.ADMIN,
                status=AccountStatus.ACTIVE,
            ),
        ]
    )
    await session.commit()
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "AdminPassword123!"},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def create_payload(session: AsyncSession) -> dict[str, str]:
    faculty = await session.scalar(select(Faculty))
    assert faculty is not None
    return {
        "username": "jsmith",
        "semester_id": str(DEV_SEMESTER_ID),
        "first_name": "John",
        "last_name": "Smith",
        "email": "jsmith@example.edu.au",
        "faculty_id": str(faculty.id),
    }


@pytest.mark.asyncio
async def test_create_supervisor_emails_generated_password(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    email_sender: FakeEmailSender,
) -> None:
    response = await client.post(
        "/api/v1/admin/supervisors", headers=admin_headers, json=await create_payload(session)
    )

    assert response.status_code == 201, response.text
    assert len(email_sender.sent) == 1
    message = email_sender.sent[0]
    assert message.to == "jsmith@example.edu.au"
    assert "Username: jsmith" in message.text
    assert await login(client, "jsmith", extract_password(message.text)) == 200


@pytest.mark.asyncio
async def test_create_supervisor_rolls_back_when_email_fails(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    email_sender: FakeEmailSender,
) -> None:
    email_sender.fail = True

    response = await client.post(
        "/api/v1/admin/supervisors", headers=admin_headers, json=await create_payload(session)
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "EMAIL_DELIVERY_FAILED"
    assert await session.scalar(select(User).where(User.username == "jsmith")) is None
    assert (
        await session.scalar(
            select(SupervisorProfile).where(SupervisorProfile.email == "jsmith@example.edu.au")
        )
        is None
    )


@pytest.mark.asyncio
async def test_admin_password_reset_emails_new_password(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    email_sender: FakeEmailSender,
) -> None:
    created = await client.post(
        "/api/v1/admin/supervisors", headers=admin_headers, json=await create_payload(session)
    )
    original_password = extract_password(email_sender.sent[0].text)

    response = await client.post(
        f"/api/v1/admin/supervisors/{created.json()['id']}/password-reset",
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["email"] == "jsmith@example.edu.au"
    assert len(email_sender.sent) == 2
    new_password = extract_password(email_sender.sent[1].text)
    assert new_password != original_password
    assert await login(client, "jsmith", original_password) == 401
    assert await login(client, "jsmith", new_password) == 200


@pytest.mark.asyncio
async def test_admin_password_reset_keeps_old_password_when_email_fails(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    email_sender: FakeEmailSender,
) -> None:
    created = await client.post(
        "/api/v1/admin/supervisors", headers=admin_headers, json=await create_payload(session)
    )
    original_password = extract_password(email_sender.sent[0].text)
    email_sender.fail = True

    response = await client.post(
        f"/api/v1/admin/supervisors/{created.json()['id']}/password-reset",
        headers=admin_headers,
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "EMAIL_DELIVERY_FAILED"
    assert await login(client, "jsmith", original_password) == 200


@pytest.mark.asyncio
async def test_create_supervisor_rejects_client_supplied_password(
    client: AsyncClient, session: AsyncSession, admin_headers: dict[str, str]
) -> None:
    payload = {**await create_payload(session), "password": "Password123"}

    response = await client.post("/api/v1/admin/supervisors", headers=admin_headers, json=payload)

    assert response.status_code == 422
