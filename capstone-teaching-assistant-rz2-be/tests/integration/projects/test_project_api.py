from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import Conversation, File, FileProcessingStatus, MessageFile
from app.common.limits import MAX_PROJECT_INSTRUCTIONS_LENGTH
from tests.conftest import DEV_SUPERVISOR_ID


@pytest.mark.asyncio
async def test_project_crud_and_project_files(client: AsyncClient, session: AsyncSession) -> None:
    create_response = await client.post(
        "/api/v1/projects",
        json={"name": "Team Alpha", "instructions": "Focus on risks."},
    )
    assert create_response.status_code == 201
    project_id = create_response.json()["id"]

    list_response = await client.get("/api/v1/projects")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()["items"]] == [project_id]

    detail_response = await client.get(f"/api/v1/projects/{project_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["name"] == "Team Alpha"

    update_response = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Team Alpha 2026", "instructions": "Updated."},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Team Alpha 2026"

    clear_instructions_response = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"instructions": " \n\t "},
    )
    assert clear_instructions_response.status_code == 200
    assert clear_instructions_response.json()["name"] == "Team Alpha 2026"
    assert clear_instructions_response.json()["instructions"] is None

    invalid_name_response = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": None},
    )
    assert invalid_name_response.status_code == 422
    assert invalid_name_response.json()["error"]["code"] == "VALIDATION_ERROR"

    empty_update_response = await client.patch(f"/api/v1/projects/{project_id}", json={})
    assert empty_update_response.status_code == 422
    assert empty_update_response.json()["error"]["code"] == "VALIDATION_ERROR"

    conversation = Conversation(
        supervisor_id=DEV_SUPERVISOR_ID,
        project_id=UUID(project_id),
        title="Project chat",
    )
    file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="handbook.txt",
        stored_filename="handbook.txt",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/handbook.txt",
        mime_type="text/plain",
        file_size_bytes=128,
        processing_status=FileProcessingStatus.READY,
    )
    session.add_all([conversation, file])
    await session.flush()
    session.add(
        MessageFile(
            conversation_id=conversation.id,
            message_id=None,
            file_id=file.id,
        )
    )
    await session.commit()

    files_response = await client.get(f"/api/v1/projects/{project_id}/files")
    assert files_response.status_code == 200
    assert [item["id"] for item in files_response.json()["items"]] == [str(file.id)]

    delete_response = await client.delete(f"/api/v1/projects/{project_id}")
    assert delete_response.status_code == 204

    missing_response = await client.get(f"/api/v1/projects/{project_id}")
    assert missing_response.status_code == 404


@pytest.mark.asyncio
async def test_project_rejects_overlong_instructions(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/projects",
        json={
            "name": "Team Alpha",
            "instructions": "a" * (MAX_PROJECT_INSTRUCTIONS_LENGTH + 1),
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
