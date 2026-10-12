from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import (
    AccountStatus,
    Faculty,
    RevokedToken,
    SupervisorProfile,
    User,
    UserRole,
)
from app.common.security import MAX_PASSWORD_LENGTH, hash_password
from app.modules.auth.auth_repository import AuthRepository
from tests.conftest import DEV_SEMESTER_ID


@pytest.mark.asyncio
async def test_login_account_faculties_and_password_workflow(
    client: AsyncClient, session: AsyncSession
) -> None:
    faculty = Faculty(code="SCI", name="School of Science", is_active=True)
    supervisor = User(
        username="rzhou",
        password_hash=hash_password("Password123"),
        role=UserRole.SUPERVISOR,
        status=AccountStatus.ACTIVE,
    )
    session.add_all([faculty, supervisor])
    await session.flush()
    session.add(
        SupervisorProfile(
            semester_id=DEV_SEMESTER_ID,
            user_id=supervisor.id,
            faculty_id=faculty.id,
            first_name="Rui",
            last_name="Zhou",
            email="rzhou@example.edu.au",
            phone="0400000000",
        )
    )
    await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "rzhou", "password": "Password123"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    account_response = await client.get("/api/v1/account", headers=headers)
    assert account_response.status_code == 200
    assert account_response.json()["profile"]["faculty"]["code"] == "SCI"

    faculties_response = await client.get("/api/v1/faculties", headers=headers)
    assert faculties_response.status_code == 200
    assert faculties_response.json()["items"][0]["name"] == "School of Science"

    password_response = await client.put(
        "/api/v1/account/password",
        headers=headers,
        json={"current_password": "Password123", "new_password": "NewPassword456"},
    )
    assert password_response.status_code == 200

    old_token_response = await client.get("/api/v1/account", headers=headers)
    assert old_token_response.status_code == 401
    assert old_token_response.json()["error"]["code"] == "UNAUTHENTICATED"

    new_login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "rzhou", "password": "NewPassword456"},
    )
    assert new_login_response.status_code == 200

    logout_response = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_response.status_code == 204

    repeated_logout_response = await client.post("/api/v1/auth/logout", headers=headers)
    assert repeated_logout_response.status_code == 204

    revoked_response = await client.get("/api/v1/account", headers=headers)
    assert revoked_response.status_code == 401
    assert revoked_response.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_successful_login_purges_expired_revoked_tokens(
    client: AsyncClient, session: AsyncSession
) -> None:
    supervisor = User(
        username="rzhou",
        password_hash=hash_password("Password123"),
        role=UserRole.SUPERVISOR,
        status=AccountStatus.ACTIVE,
    )
    session.add_all(
        [
            supervisor,
            RevokedToken(
                token_hash="a" * 64,
                expires_at=datetime.now(UTC) - timedelta(minutes=1),
            ),
        ]
    )
    await session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "rzhou", "password": "Password123"},
    )

    assert response.status_code == 200
    expired_token = await session.scalar(
        select(RevokedToken).where(RevokedToken.token_hash == "a" * 64)
    )
    assert expired_token is None


@pytest.mark.asyncio
async def test_login_strips_username_without_stripping_password(
    client: AsyncClient, session: AsyncSession
) -> None:
    supervisor = User(
        username="rzhou",
        password_hash=hash_password(" Password123 "),
        role=UserRole.SUPERVISOR,
        status=AccountStatus.ACTIVE,
    )
    session.add(supervisor)
    await session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "  rzhou\t", "password": " Password123 "},
    )

    assert response.status_code == 200
    assert response.json()["username"] == "rzhou"


@pytest.mark.asyncio
async def test_account_hides_profile_when_faculty_is_inactive(
    client: AsyncClient, session: AsyncSession
) -> None:
    faculty = Faculty(code="SCI", name="School of Science", is_active=False)
    supervisor = User(
        username="rzhou",
        password_hash=hash_password("Password123"),
        role=UserRole.SUPERVISOR,
        status=AccountStatus.ACTIVE,
    )
    session.add_all([faculty, supervisor])
    await session.flush()
    session.add(
        SupervisorProfile(
            semester_id=DEV_SEMESTER_ID,
            user_id=supervisor.id,
            faculty_id=faculty.id,
            first_name="Rui",
            last_name="Zhou",
            email="rzhou@example.edu.au",
        )
    )
    await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "rzhou", "password": "Password123"},
    )
    headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    account_response = await client.get("/api/v1/account", headers=headers)
    faculties_response = await client.get("/api/v1/faculties", headers=headers)

    assert account_response.status_code == 200
    assert account_response.json()["profile"] is None
    assert faculties_response.status_code == 200
    assert faculties_response.json()["items"] == []


@pytest.mark.asyncio
async def test_revoke_token_is_idempotent_for_existing_hash(session: AsyncSession) -> None:
    token_hash = "b" * 64
    expires_at = datetime.now(UTC) + timedelta(minutes=30)
    session.add(RevokedToken(token_hash=token_hash, expires_at=expires_at))
    await session.commit()

    await AuthRepository(session).revoke_token(token_hash, expires_at)
    await session.commit()

    rows = list(
        await session.scalars(select(RevokedToken).where(RevokedToken.token_hash == token_hash))
    )
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_protected_endpoint_rejects_missing_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/account")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_logout_rejects_missing_token(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/logout")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_password_inputs_reject_overlong_values(
    client: AsyncClient, session: AsyncSession
) -> None:
    supervisor = User(
        username="rzhou",
        password_hash=hash_password("Password123"),
        role=UserRole.SUPERVISOR,
        status=AccountStatus.ACTIVE,
    )
    session.add(supervisor)
    await session.commit()

    overlong_password = "a" * (MAX_PASSWORD_LENGTH + 1)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "rzhou", "password": overlong_password},
    )
    assert login_response.status_code == 422
    assert login_response.json()["error"]["code"] == "VALIDATION_ERROR"

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "rzhou", "password": "Password123"},
    )
    assert login_response.status_code == 200
    headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    password_response = await client.put(
        "/api/v1/account/password",
        headers=headers,
        json={"current_password": "Password123", "new_password": overlong_password},
    )
    assert password_response.status_code == 422
    assert password_response.json()["error"]["code"] == "VALIDATION_ERROR"
