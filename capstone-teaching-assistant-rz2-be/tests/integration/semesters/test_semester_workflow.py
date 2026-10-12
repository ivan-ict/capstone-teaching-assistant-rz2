"""Semester boundaries protect private history while sharing teaching documents."""

from datetime import date
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.common.auth import CurrentUser, get_current_user
from app.common.db_models import AccountStatus, Faculty, SupervisorProfile, UserRole
from app.main import app
from tests.conftest import DEV_SEMESTER_ID, DEV_SUPERVISOR_ID, OTHER_SUPERVISOR_ID


@pytest.fixture(autouse=True)
async def assigned_profiles(session):
    faculty = Faculty(code="TEST", name="Test faculty", is_active=True)
    session.add(faculty)
    await session.flush()
    for index, user_id in enumerate((DEV_SUPERVISOR_ID, OTHER_SUPERVISOR_ID)):
        session.add(
            SupervisorProfile(
                user_id=user_id,
                faculty_id=faculty.id,
                first_name="Test",
                last_name=str(index),
                email=f"test{index}@example.com",
                semester_id=DEV_SEMESTER_ID,
            )
        )
    await session.commit()


@pytest.fixture
async def admin_client(client):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=uuid4(), username="admin", role=UserRole.ADMIN, status=AccountStatus.ACTIVE
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as admin:
        yield admin
    app.dependency_overrides.pop(get_current_user, None)


async def create_semester(client, name="2026 S1"):
    response = await client.post(
        "/api/v1/admin/semesters",
        json={"name": name, "year": 2026, "start_date": "2026-01-01", "end_date": "2026-06-30"},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def test_transfer_hides_old_history_and_return_restores_it(client, admin_client):
    original = (await client.get("/api/v1/conversations")).json()
    assert original["items"] == []
    first = (await client.post("/api/v1/conversations", json={})).json()
    destination = await create_semester(admin_client)
    moved = await admin_client.post(
        f"/api/v1/admin/semesters/{destination}/supervisors",
        json={"supervisor_ids": [str(DEV_SUPERVISOR_ID)]},
    )
    assert moved.status_code == 200, moved.text
    assert (await client.get("/api/v1/conversations")).json()["items"] == []
    assert (await client.get(f"/api/v1/conversations/{first['id']}")).status_code == 404
    assert (await client.get("/api/v1/conversations/search", params={"query": "New"})).json()[
        "items"
    ] == []
    await admin_client.post(
        f"/api/v1/admin/semesters/{first['semester_id']}/supervisors",
        json={"supervisor_ids": [str(DEV_SUPERVISOR_ID)]},
    )
    assert (await client.get(f"/api/v1/conversations/{first['id']}")).status_code == 200


async def test_archiving_retains_history_but_blocks_all_mutations(client, admin_client):
    conversation = (await client.post("/api/v1/conversations", json={})).json()
    assert (
        await admin_client.delete(f"/api/v1/admin/semesters/{conversation['semester_id']}")
    ).status_code == 204
    assert (
        await client.get(f"/api/v1/conversations/{conversation['id']}/messages")
    ).status_code == 200
    for method, path, body in [
        ("POST", "/api/v1/conversations", {}),
        ("PATCH", f"/api/v1/conversations/{conversation['id']}", {"title": "Changed"}),
        ("DELETE", f"/api/v1/conversations/{conversation['id']}", None),
        ("POST", f"/api/v1/conversations/{conversation['id']}/messages", {"content": "Hello"}),
    ]:
        response = await client.request(method, path, json=body)
        assert response.status_code == 409, response.text
        assert response.json()["error"]["code"] == "SEMESTER_ARCHIVED"


async def test_invalid_batch_does_not_partially_move_supervisors(client, admin_client):
    conversation = (await client.post("/api/v1/conversations", json={})).json()
    destination = await create_semester(admin_client)
    response = await admin_client.post(
        f"/api/v1/admin/semesters/{destination}/supervisors",
        json={"supervisor_ids": [str(DEV_SUPERVISOR_ID), str(uuid4())]},
    )
    assert response.status_code == 409
    assert (await client.get(f"/api/v1/conversations/{conversation['id']}")).status_code == 200


async def test_dates_are_validated_but_do_not_schedule_chat(client, admin_client):
    response = await admin_client.post(
        "/api/v1/admin/semesters",
        json={
            "name": "Invalid",
            "year": date.today().year,
            "start_date": "2026-12-31",
            "end_date": "2026-01-01",
        },
    )
    assert response.status_code == 422
    assert (await client.post("/api/v1/conversations", json={})).status_code == 201


async def test_semester_dates_are_optional(admin_client):
    created = await admin_client.post(
        "/api/v1/admin/semesters",
        json={"name": "Undated", "year": 2026},
    )
    assert created.status_code == 201, created.text
    assert created.json()["start_date"] is None
    assert created.json()["end_date"] is None

    partial = await admin_client.post(
        "/api/v1/admin/semesters",
        json={"name": "Start only", "year": 2026, "start_date": "2026-02-01", "end_date": None},
    )
    assert partial.status_code == 201, partial.text

    listed = await admin_client.get("/api/v1/admin/semesters", params={"search": "dated"})
    assert listed.status_code == 200
    assert [item["name"] for item in listed.json()["items"]] == ["Undated"]


async def test_candidate_list_excludes_inactive_and_current_members_and_reports_source(
    client, admin_client, session
):
    from app.common.db_models import User

    destination = await create_semester(admin_client)
    user = await session.get(User, OTHER_SUPERVISOR_ID)
    user.status = AccountStatus.INACTIVE
    await session.commit()
    result = await admin_client.get(f"/api/v1/admin/semesters/{destination}/supervisor-candidates")
    assert [item["id"] for item in result.json()["items"]] == [str(DEV_SUPERVISOR_ID)]
    assert result.json()["items"][0]["semester"]["id"] == str(DEV_SEMESTER_ID)
    await admin_client.post(
        f"/api/v1/admin/semesters/{destination}/supervisors",
        json={"supervisor_ids": [str(DEV_SUPERVISOR_ID)]},
    )
    assert (
        await admin_client.get(f"/api/v1/admin/semesters/{destination}/supervisor-candidates")
    ).json()["total"] == 0
    assert (await admin_client.get(f"/api/v1/admin/semesters/{destination}")).json()[
        "supervisor_count"
    ] == 1
    assert (await admin_client.get(f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}")).json()[
        "supervisor_count"
    ] == 1


async def test_supervisor_creation_requires_an_active_semester(admin_client, session):
    from sqlalchemy import select

    faculty = await session.scalar(select(Faculty))
    payload = {
        "username": "new-supervisor",
        "first_name": "New",
        "last_name": "Supervisor",
        "email": "new@example.com",
        "faculty_id": str(faculty.id),
    }
    assert (await admin_client.post("/api/v1/admin/supervisors", json=payload)).status_code == 422
    await admin_client.delete(f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}")
    payload["semester_id"] = str(DEV_SEMESTER_ID)
    assert (await admin_client.post("/api/v1/admin/supervisors", json=payload)).status_code == 409
    payload["semester_id"] = await create_semester(admin_client, "Active")
    response = await admin_client.post("/api/v1/admin/supervisors", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["profile"]["semester"]["id"] == payload["semester_id"]


async def test_archived_resources_do_not_reveal_foreign_conversations(
    client, admin_client, session
):
    from app.common.db_models import Conversation

    other = Conversation(
        supervisor_id=OTHER_SUPERVISOR_ID, semester_id=DEV_SEMESTER_ID, title="Private"
    )
    session.add(other)
    await session.commit()
    await admin_client.delete(f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}")
    assert (
        await client.patch(f"/api/v1/conversations/{other.id}", json={"title": "Leak"})
    ).status_code == 404
    assert (await client.delete(f"/api/v1/conversations/{other.id}")).status_code == 404
    assert (
        await client.post(f"/api/v1/conversations/{other.id}/messages", json={"content": "Leak"})
    ).status_code == 404
