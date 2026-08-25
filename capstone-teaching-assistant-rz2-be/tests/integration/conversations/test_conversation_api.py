from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
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
from app.common.limits import MAX_FILE_IDS_PER_CHAT_CONTEXT
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

    empty_move_response = await client.patch(
        f"/api/v1/conversations/{conversation_id}/project",
        json={},
    )
    assert empty_move_response.status_code == 422
    assert empty_move_response.json()["error"]["code"] == "VALIDATION_ERROR"

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

    conversation_uuid = UUID(conversation_id)
    session.add(
        Message(
            conversation_id=conversation_uuid,
            role=MessageRole.USER,
            content="What should I do?",
            status=MessageStatus.COMPLETED,
            sequence_no=1,
        )
    )
    await session.commit()

    delete_response = await client.delete(f"/api/v1/conversations/{conversation_id}")
    assert delete_response.status_code == 204

    deleted_messages = list(
        await session.scalars(select(Message).where(Message.conversation_id == conversation_uuid))
    )
    assert all(message.deleted_at is not None for message in deleted_messages)

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
async def test_conversation_messages_hide_soft_deleted_file_links(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Capstone Questions")
    file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="Deleted Attachment.pdf",
        stored_filename="deleted-attachment.pdf",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/deleted-attachment.pdf",
        mime_type="application/pdf",
        file_size_bytes=120450,
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
            deleted_at=datetime.now(UTC),
        )
    )
    await session.commit()

    response = await client.get(f"/api/v1/conversations/{conversation.id}/messages")

    assert response.status_code == 200
    assert response.json()["items"][0]["files"] == []


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
async def test_framework_errors_use_api_error_shape(client: AsyncClient) -> None:
    missing_response = await client.get("/api/v1/not-a-real-route")
    method_response = await client.put("/api/v1/faculties")

    assert missing_response.status_code == 404
    assert missing_response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert method_response.status_code == 405
    assert method_response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_openapi_includes_conversation_paths(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    paths = schema["paths"]
    assert "/api/v1/conversations" in paths
    assert "/api/v1/conversations/{conversation_id}/messages" in paths
    assert "HTTPValidationError" not in schema["components"]["schemas"]
    assert paths["/api/v1/auth/login"]["post"]["responses"]["422"]["content"]["application/json"][
        "schema"
    ] == {"$ref": "#/components/schemas/ErrorResponseDTO"}
    assert "422" not in paths["/api/v1/account"]["get"]["responses"]
    assert "401" not in paths["/api/v1/auth/login"]["post"]["responses"]
    assert paths["/api/v1/account"]["get"]["responses"]["401"]["content"]["application/json"][
        "schema"
    ] == {"$ref": "#/components/schemas/ErrorResponseDTO"}
    assert "403" not in paths["/api/v1/account"]["get"]["responses"]
    assert paths["/api/v1/conversations"]["post"]["responses"]["403"]["content"][
        "application/json"
    ]["schema"] == {"$ref": "#/components/schemas/ErrorResponseDTO"}


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


@pytest.mark.asyncio
async def test_associate_files_to_conversation_is_idempotent(
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

    payload = {"file_ids": [str(file.id)]}
    first_response = await client.post(
        f"/api/v1/conversations/{conversation.id}/files", json=payload
    )
    second_response = await client.post(
        f"/api/v1/conversations/{conversation.id}/files",
        json=payload,
    )
    links = list(
        await session.scalars(
            select(MessageFile).where(
                MessageFile.conversation_id == conversation.id,
                MessageFile.message_id.is_(None),
                MessageFile.file_id == file.id,
                MessageFile.deleted_at.is_(None),
            )
        )
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert len(links) == 1


@pytest.mark.asyncio
async def test_associate_files_rejects_too_many_file_ids(client: AsyncClient) -> None:
    response = await client.post(
        f"/api/v1/conversations/{uuid4()}/files",
        json={"file_ids": [str(uuid4()) for _ in range(MAX_FILE_IDS_PER_CHAT_CONTEXT + 1)]},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_associate_files_rejects_total_above_limit(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Capstone Questions")
    files = [
        File(
            supervisor_id=DEV_SUPERVISOR_ID,
            original_filename=f"Guide {index}.txt",
            stored_filename=f"guide-{index}.txt",
            storage_base_url="http://localhost:9000/capstone-files/",
            storage_path=f"supervisors/dev/files/guide-{index}.txt",
            mime_type="text/plain",
            file_size_bytes=64,
            processing_status=FileProcessingStatus.READY,
        )
        for index in range(MAX_FILE_IDS_PER_CHAT_CONTEXT + 1)
    ]
    session.add(conversation)
    session.add_all(files)
    await session.flush()
    session.add_all(
        [
            MessageFile(
                conversation_id=conversation.id,
                message_id=None,
                file_id=file.id,
            )
            for file in files[:MAX_FILE_IDS_PER_CHAT_CONTEXT]
        ]
    )
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/files",
        json={"file_ids": [str(files[-1].id)]},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "FILE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_associate_files_ignores_preselected_links_to_deleted_files(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Capstone Questions")
    stale_files = [
        File(
            supervisor_id=DEV_SUPERVISOR_ID,
            original_filename=f"Deleted Guide {index}.txt",
            stored_filename=f"deleted-guide-{index}.txt",
            storage_base_url="http://localhost:9000/capstone-files/",
            storage_path=f"supervisors/dev/files/deleted-guide-{index}.txt",
            mime_type="text/plain",
            file_size_bytes=64,
            processing_status=FileProcessingStatus.READY,
            deleted_at=datetime.now(UTC),
        )
        for index in range(MAX_FILE_IDS_PER_CHAT_CONTEXT)
    ]
    active_file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="Active Guide.txt",
        stored_filename="active-guide.txt",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/active-guide.txt",
        mime_type="text/plain",
        file_size_bytes=64,
        processing_status=FileProcessingStatus.READY,
    )
    session.add(conversation)
    session.add_all([*stale_files, active_file])
    await session.flush()
    session.add_all(
        [
            MessageFile(
                conversation_id=conversation.id,
                message_id=None,
                file_id=file.id,
            )
            for file in stale_files
        ]
    )
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/files",
        json={"file_ids": [str(active_file.id)]},
    )

    assert response.status_code == 200
    assert response.json()["files"] == [
        {
            "id": str(active_file.id),
            "original_filename": "Active Guide.txt",
        }
    ]


@pytest.mark.asyncio
async def test_associate_files_rejects_not_ready_file(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Capstone Questions")
    file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="Processing Guide.pdf",
        stored_filename="processing-guide.pdf",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/processing-guide.pdf",
        mime_type="application/pdf",
        file_size_bytes=120450,
        processing_status=FileProcessingStatus.PROCESSING,
    )
    session.add_all([conversation, file])
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/files",
        json={"file_ids": [str(file.id)]},
    )
    links = list(
        await session.scalars(
            select(MessageFile).where(
                MessageFile.conversation_id == conversation.id,
                MessageFile.file_id == file.id,
            )
        )
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "FILE_NOT_READY"
    assert links == []


@pytest.mark.asyncio
async def test_associate_files_ignores_soft_deleted_preselected_link(
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
    await session.flush()
    session.add(
        MessageFile(
            conversation_id=conversation.id,
            message_id=None,
            file_id=file.id,
            deleted_at=datetime.now(UTC),
        )
    )
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/files",
        json={"file_ids": [str(file.id)]},
    )

    assert response.status_code == 200
    assert response.json()["files"] == [
        {
            "id": str(file.id),
            "original_filename": "Assessment Guide.pdf",
        }
    ]
