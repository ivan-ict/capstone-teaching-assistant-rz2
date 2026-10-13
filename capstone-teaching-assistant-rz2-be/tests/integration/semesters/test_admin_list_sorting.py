"""Admin list endpoints accept sort_by/sort_order and reject unknown sort fields."""

from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.common.auth import CurrentUser, get_current_user
from app.common.db_models import AccountStatus, Faculty, UserRole
from app.main import app
from tests.conftest import DEV_SEMESTER_ID


@pytest.fixture
async def admin_client(client):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=uuid4(), username="admin", role=UserRole.ADMIN, status=AccountStatus.ACTIVE
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as admin:
        yield admin
    app.dependency_overrides.pop(get_current_user, None)


def names(response, key="name"):
    assert response.status_code == 200, response.text
    return [item[key] for item in response.json()["items"]]


async def test_semesters_sort_by_name(admin_client):
    for name in ("B term", "A term", "C term"):
        response = await admin_client.post(
            "/api/v1/admin/semesters", json={"name": name, "year": 2030}
        )
        assert response.status_code == 201, response.text

    params = {"search": "term", "sort_by": "name"}
    ascending = await admin_client.get("/api/v1/admin/semesters", params=params)
    descending = await admin_client.get(
        "/api/v1/admin/semesters", params={**params, "sort_order": "desc"}
    )

    assert names(ascending) == ["A term", "B term", "C term"]
    assert names(descending) == ["C term", "B term", "A term"]


async def test_semesters_sort_by_file_count(admin_client):
    response = await admin_client.get(
        "/api/v1/admin/semesters", params={"sort_by": "file_count", "sort_order": "desc"}
    )
    assert response.status_code == 200, response.text


async def test_faculties_sort_by_code(admin_client, session):
    session.add_all(
        [
            Faculty(code="ZZZ", name="Alpha faculty", is_active=True),
            Faculty(code="AAA", name="Zulu faculty", is_active=True),
        ]
    )
    await session.commit()

    response = await admin_client.get(
        "/api/v1/admin/faculties", params={"search": "faculty", "sort_by": "code"}
    )

    assert names(response) == ["Zulu faculty", "Alpha faculty"]


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/admin/semesters",
        "/api/v1/admin/faculties",
        f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}/supervisors",
        f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}/files",
    ],
)
async def test_unknown_sort_field_is_rejected(admin_client, path):
    response = await admin_client.get(path, params={"sort_by": "password_hash"})
    assert response.status_code == 422


@pytest.mark.parametrize(
    "path",
    [
        f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}/supervisors",
        f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}/supervisor-candidates",
        f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}/files",
    ],
)
@pytest.mark.parametrize("sort_order", ["asc", "desc"])
async def test_semester_sublists_accept_each_sort_order(admin_client, path, sort_order):
    response = await admin_client.get(path, params={"sort_order": sort_order})
    assert response.status_code == 200, response.text
