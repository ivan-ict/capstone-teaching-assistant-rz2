from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import AccountStatus, Faculty, SupervisorProfile, User, UserRole
from app.common.security import hash_password


@pytest.mark.asyncio
async def test_admin_supervisor_workflow(client: AsyncClient, session: AsyncSession) -> None:
    faculty = Faculty(code="SCI", name="School of Science", is_active=True)
    admin = User(
        username="admin",
        password_hash=hash_password("AdminPassword123!"),
        role=UserRole.ADMIN,
        status=AccountStatus.ACTIVE,
    )
    session.add_all([faculty, admin])
    await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "AdminPassword123!"},
    )
    assert login_response.status_code == 200
    headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    create_response = await client.post(
        "/api/v1/admin/supervisors",
        headers=headers,
        json={
            "username": "jsmith",
            "password": "Password123",
            "first_name": "John",
            "last_name": "Smith",
            "email": "jsmith@example.edu.au",
            "phone": "0412345678",
            "faculty_id": str(faculty.id),
            "teaching_year": 2026,
            "teaching_semester": "SEMESTER_2",
        },
    )
    assert create_response.status_code == 201
    supervisor_id = create_response.json()["id"]

    list_response = await client.get("/api/v1/admin/supervisors", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    listed = list_response.json()["items"][0]
    assert listed["phone"] == "0412345678"
    assert listed["teaching_year"] == 2026
    assert listed["teaching_semester"] == "SEMESTER_2"
    assert listed["created_at"]
    assert listed["updated_at"]

    overlong_search_response = await client.get(
        "/api/v1/admin/supervisors",
        headers=headers,
        params={"search": "a" * 101},
    )
    assert overlong_search_response.status_code == 422
    assert overlong_search_response.json()["error"]["code"] == "VALIDATION_ERROR"

    detail_response = await client.get(
        f"/api/v1/admin/supervisors/{supervisor_id}", headers=headers
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["profile"]["email"] == "jsmith@example.edu.au"

    update_response = await client.patch(
        f"/api/v1/admin/supervisors/{supervisor_id}",
        headers=headers,
        json={
            "first_name": "Jonathan",
            "last_name": "Smythe",
            "email": "john.smith@example.edu.au",
            "phone": "0499999999",
            "faculty_id": str(faculty.id),
            "teaching_year": 2026,
            "teaching_semester": "SEMESTER_1",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["profile"]["email"] == "john.smith@example.edu.au"
    assert update_response.json()["profile"]["first_name"] == "Jonathan"
    assert update_response.json()["profile"]["last_name"] == "Smythe"

    clear_nullable_response = await client.patch(
        f"/api/v1/admin/supervisors/{supervisor_id}",
        headers=headers,
        json={
            "phone": " \t ",
            "teaching_year": None,
            "teaching_semester": None,
        },
    )
    assert clear_nullable_response.status_code == 200
    profile = clear_nullable_response.json()["profile"]
    assert profile["email"] == "john.smith@example.edu.au"
    assert profile["phone"] is None
    assert profile["teaching_year"] is None
    assert profile["teaching_semester"] is None

    empty_update_response = await client.patch(
        f"/api/v1/admin/supervisors/{supervisor_id}",
        headers=headers,
        json={},
    )
    assert empty_update_response.status_code == 422
    assert empty_update_response.json()["error"]["code"] == "VALIDATION_ERROR"

    for payload in ({"email": None}, {"faculty_id": None}):
        invalid_update_response = await client.patch(
            f"/api/v1/admin/supervisors/{supervisor_id}",
            headers=headers,
            json=payload,
        )
        assert invalid_update_response.status_code == 422
        assert invalid_update_response.json()["error"]["code"] == "VALIDATION_ERROR"

    status_response = await client.patch(
        f"/api/v1/admin/supervisors/{supervisor_id}/status",
        headers=headers,
        json={"status": "INACTIVE"},
    )
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "INACTIVE"

    password_response = await client.put(
        f"/api/v1/admin/supervisors/{supervisor_id}/password",
        headers=headers,
        json={"new_password": "NewPassword123"},
    )
    assert password_response.status_code == 200
    assert password_response.json()["message"] == "Supervisor password updated."

    delete_response = await client.delete(
        f"/api/v1/admin/supervisors/{supervisor_id}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    missing_response = await client.get(
        f"/api/v1/admin/supervisors/{supervisor_id}", headers=headers
    )
    assert missing_response.status_code == 404


@pytest.mark.asyncio
async def test_admin_faculty_crud_workflow(client: AsyncClient, session: AsyncSession) -> None:
    admin = User(
        username="admin",
        password_hash=hash_password("AdminPassword123!"),
        role=UserRole.ADMIN,
        status=AccountStatus.ACTIVE,
    )
    session.add(admin)
    await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "AdminPassword123!"},
    )
    headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    create_response = await client.post(
        "/api/v1/admin/faculties",
        headers=headers,
        json={"code": "ENG", "name": "Engineering"},
    )
    assert create_response.status_code == 201
    faculty_id = create_response.json()["id"]

    list_response = await client.get("/api/v1/admin/faculties", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["supervisor_count"] == 0
    assert list_response.json()["items"][0]["created_at"]

    update_response = await client.patch(
        f"/api/v1/admin/faculties/{faculty_id}",
        headers=headers,
        json={"name": "School of Engineering"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "School of Engineering"

    delete_response = await client.delete(f"/api/v1/admin/faculties/{faculty_id}", headers=headers)
    assert delete_response.status_code == 204


@pytest.mark.asyncio
async def test_create_supervisor_allows_soft_deleted_username_reuse(
    client: AsyncClient, session: AsyncSession
) -> None:
    faculty = Faculty(code="SCI", name="School of Science", is_active=True)
    admin = User(
        username="admin",
        password_hash=hash_password("AdminPassword123!"),
        role=UserRole.ADMIN,
        status=AccountStatus.ACTIVE,
    )
    deleted_user = User(
        username="jsmith",
        password_hash=hash_password("Password123"),
        role=UserRole.SUPERVISOR,
        status=AccountStatus.INACTIVE,
        deleted_at=datetime.now(UTC),
    )
    session.add_all([faculty, admin, deleted_user])
    await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "AdminPassword123!"},
    )
    headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    response = await client.post(
        "/api/v1/admin/supervisors",
        headers=headers,
        json={
            "username": "jsmith",
            "password": "Password123",
            "first_name": "John",
            "last_name": "Smith",
            "email": "john.smith@example.edu.au",
            "faculty_id": str(faculty.id),
        },
    )

    assert response.status_code == 201
    assert response.json()["username"] == "jsmith"


@pytest.mark.asyncio
async def test_create_supervisor_allows_soft_deleted_email_reuse(
    client: AsyncClient, session: AsyncSession
) -> None:
    faculty = Faculty(code="SCI", name="School of Science", is_active=True)
    admin = User(
        username="admin",
        password_hash=hash_password("AdminPassword123!"),
        role=UserRole.ADMIN,
        status=AccountStatus.ACTIVE,
    )
    deleted_user = User(
        username="deleted-supervisor",
        password_hash=hash_password("Password123"),
        role=UserRole.SUPERVISOR,
        status=AccountStatus.INACTIVE,
        deleted_at=datetime.now(UTC),
    )
    session.add_all([faculty, admin, deleted_user])
    await session.flush()
    session.add(
        SupervisorProfile(
            user_id=deleted_user.id,
            faculty_id=faculty.id,
            first_name="Deleted",
            last_name="Supervisor",
            email="jsmith@example.edu.au",
            deleted_at=datetime.now(UTC),
        )
    )
    await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "AdminPassword123!"},
    )
    headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    response = await client.post(
        "/api/v1/admin/supervisors",
        headers=headers,
        json={
            "username": "jsmith",
            "password": "Password123",
            "first_name": "John",
            "last_name": "Smith",
            "email": "jsmith@example.edu.au",
            "faculty_id": str(faculty.id),
        },
    )

    assert response.status_code == 201
    assert response.json()["profile"]["email"] == "jsmith@example.edu.au"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("username", "   "),
        ("first_name", " \t "),
        ("last_name", "\n "),
        ("email", f"{'a' * 315}@example.edu.au"),
        ("teaching_year", 2200),
    ],
)
async def test_create_supervisor_rejects_values_outside_database_bounds(
    client: AsyncClient,
    session: AsyncSession,
    field: str,
    value: object,
) -> None:
    faculty = Faculty(code="SCI", name="School of Science", is_active=True)
    admin = User(
        username="admin",
        password_hash=hash_password("AdminPassword123!"),
        role=UserRole.ADMIN,
        status=AccountStatus.ACTIVE,
    )
    session.add_all([faculty, admin])
    await session.commit()

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "AdminPassword123!"},
    )
    headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}
    payload = {
        "username": "jsmith",
        "password": "Password123",
        "first_name": "John",
        "last_name": "Smith",
        "email": "jsmith@example.edu.au",
        "faculty_id": str(faculty.id),
    }
    payload[field] = value

    response = await client.post(
        "/api/v1/admin/supervisors",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
