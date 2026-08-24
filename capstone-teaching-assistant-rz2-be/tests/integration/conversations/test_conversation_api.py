from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import (
    Conversation,
    File,
    FileProcessingStatus,
    Message,
    MessageFile,
    MessageRole,
    MessageStatus,
    Project,
)
from tests.conftest import DEV_SUPERVISOR_ID, OTHER_SUPERVISOR_ID


@pytest.mark.asyncio
async def test_conversation_crud_workflow(client: AsyncClient, session: AsyncSession) -> None:
    project = Project(supervisor_id=DEV_SUPERVISOR_ID, name="Team Alpha")
    next_project = Project(supervisor_id=DEV_SUPERVISOR_ID, name="Team Beta")
    session.add_all([project, next_project])
    await session.commit()

    create_response = await client.post(
        "/api/v1/conversations",
        json={"project_id": str(project.id)},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["project_id"] == str(project.id)
    assert created["title"] == "New conversation"

    conversation_id = created["id"]

    list_response = await client.get(
        "/api/v1/conversations", params={"project_id": str(project.id)}
    )
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()["items"]] == [conversation_id]

    detail_response = await client.get(f"/api/v1/conversations/{conversation_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["project"] == {
        "id": str(project.id),
        "name": "Team Alpha",
    }

    rename_response = await client.patch(
        f"/api/v1/conversations/{conversation_id}",
        json={"title": "Handling Team Contribution Issues"},
    )
    assert rename_response.status_code == 200
    assert rename_response.json()["title"] == "Handling Team Contribution Issues"

    move_response = await client.patch(
        f"/api/v1/conversations/{conversation_id}/project",
        json={"project_id": str(next_project.id)},
    )
    assert move_response.status_code == 200
    assert move_response.json()["project_id"] == str(next_project.id)

    remove_project_response = await client.patch(
        f"/api/v1/conversations/{conversation_id}/project",
        json={"project_id": None},
    )
    assert remove_project_response.status_code == 200
    assert remove_project_response.json()["project_id"] is None

    unprojected_response = await client.get(
        "/api/v1/conversations",
        params={"project_id": "unprojected"},
    )
    assert unprojected_response.status_code == 200
    assert [item["id"] for item in unprojected_response.json()["items"]] == [conversation_id]

    delete_response = await client.delete(f"/api/v1/conversations/{conversation_id}")
    assert delete_response.status_code == 204

    missing_response = await client.get(f"/api/v1/conversations/{conversation_id}")
    assert missing_response.status_code == 404
    assert missing_response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


@pytest.mark.asyncio
async def test_conversation_messages_and_files(client: AsyncClient, session: AsyncSession) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Capstone Questions")
    file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="Capstone Handbook.pdf",
        stored_filename="handbook.pdf",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/handbook.pdf",
        mime_type="application/pdf",
        file_size_bytes=528944,
        processing_status=FileProcessingStatus.READY,
    )
    session.add_all([conversation, file])
    await session.flush()
    message = Message(
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content="What should I do?",
        status=MessageStatus.COMPLETED,
        sequence_no=1,
    )
    session.add(message)
    await session.flush()
    session.add(
        MessageFile(
            conversation_id=conversation.id,
            message_id=message.id,
            file_id=file.id,
        )
    )
    await session.commit()

    messages_response = await client.get(f"/api/v1/conversations/{conversation.id}/messages")
    assert messages_response.status_code == 200
    messages = messages_response.json()["items"]
    assert messages[0]["files"][0]["original_filename"] == "Capstone Handbook.pdf"

    files_response = await client.get(f"/api/v1/conversations/{conversation.id}/files")
    assert files_response.status_code == 200
    files = files_response.json()["items"]
    assert files == [
        {
            "id": str(file.id),
            "original_filename": "Capstone Handbook.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 528944,
            "processing_status": "READY",
        }
    ]


@pytest.mark.asyncio
async def test_conversation_ownership_returns_not_found(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=OTHER_SUPERVISOR_ID, title="Other")
    session.add(conversation)
    await session.commit()

    response = await client.get(f"/api/v1/conversations/{conversation.id}")

    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Conversation not found."


@pytest.mark.asyncio
async def test_invalid_project_filter_returns_validation_error(client: AsyncClient) -> None:
    response = await client.get("/api/v1/conversations", params={"project_id": "invalid"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_openapi_includes_conversation_paths(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/conversations" in paths
    assert "/api/v1/conversations/{conversation_id}/messages" in paths


@pytest.mark.asyncio
async def test_missing_conversation_delete_returns_not_found(client: AsyncClient) -> None:
    response = await client.delete(f"/api/v1/conversations/{uuid4()}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


@pytest.mark.asyncio
async def test_associate_files_to_conversation_before_message(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Capstone Questions")
    file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="Assessment Guide.pdf",
        stored_filename="assessment-guide.pdf",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/assessment-guide.pdf",
        mime_type="application/pdf",
        file_size_bytes=120450,
        processing_status=FileProcessingStatus.READY,
    )
    session.add_all([conversation, file])
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/files",
        json={"file_ids": [str(file.id)]},
    )

    assert response.status_code == 200
    assert response.json() == {
        "conversation_id": str(conversation.id),
        "files": [
            {
                "id": str(file.id),
                "original_filename": "Assessment Guide.pdf",
            }
        ],
    }

    files_response = await client.get(f"/api/v1/conversations/{conversation.id}/files")

    assert files_response.status_code == 200
    assert [item["id"] for item in files_response.json()["items"]] == [str(file.id)]
