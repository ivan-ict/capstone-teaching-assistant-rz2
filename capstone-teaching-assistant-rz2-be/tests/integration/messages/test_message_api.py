from collections.abc import AsyncIterator
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
)
from app.common.limits import MAX_FILE_IDS_PER_CHAT_CONTEXT, MAX_MESSAGE_CONTENT_LENGTH
from tests.conftest import DEV_SUPERVISOR_ID


class FakeChatProvider:
    def __init__(self, settings) -> None:
        self.settings = settings

    async def stream_answer(
        self,
        system_prompt: str,
        chat_history: list[tuple[str, str]],
        user_prompt: str,
    ) -> AsyncIterator[str]:
        yield "Discuss expectations "
        yield "with the team."


class FakeEmbeddingProvider:
    def __init__(self, settings) -> None:
        self.settings = settings

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[0.1] * self.settings.embedding_dimension for _text in texts]

    async def embed_query(self, text: str) -> list[float]:
        return [0.1] * self.settings.embedding_dimension


@pytest.mark.asyncio
async def test_first_message_persists_generated_conversation_title(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="New conversation")
    session.add(conversation)
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={
            "content": "A first question long enough to verify title truncation is persisted",
            "file_ids": [],
        },
    )
    await session.refresh(conversation)

    assert response.status_code == 201
    assert response.json()["conversation_title"] == "A first question long enough to verify tit..."
    assert conversation.title == "A first question long enough to verify tit..."


@pytest.mark.asyncio
async def test_first_message_preserves_custom_conversation_title(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    session.add(conversation)
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={"content": "This question must not replace the custom title.", "file_ids": []},
    )
    await session.refresh(conversation)

    assert response.status_code == 201
    assert response.json()["conversation_title"] == "Team issues"
    assert conversation.title == "Team issues"


@pytest.mark.asyncio
async def test_chat_message_stream_and_retry(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.modules.messages.message_service.OllamaChatProvider", FakeChatProvider)
    monkeypatch.setattr(
        "app.modules.messages.message_service.OllamaEmbeddingProvider", FakeEmbeddingProvider
    )
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    session.add(conversation)
    await session.commit()

    create_response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={"content": "What if a student misses meetings?", "file_ids": []},
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["user_message"]["status"] == "COMPLETED"
    assert created["assistant_message"]["status"] == "PENDING"

    stream_response = await client.get(created["stream_url"])
    assert stream_response.status_code == 200
    assert "event: start" in stream_response.text
    assert "event: token" in stream_response.text
    assert "event: complete" in stream_response.text

    assistant_message = await session.get(Message, UUID(created["assistant_message"]["id"]))
    assert assistant_message is not None
    assert assistant_message.content == "Discuss expectations with the team."
    assert assistant_message.status == MessageStatus.COMPLETED

    duplicate_stream_response = await client.get(created["stream_url"])
    await session.refresh(assistant_message)
    assert duplicate_stream_response.status_code == 409
    assert duplicate_stream_response.json()["error"]["code"] == "INVALID_MESSAGE_STATUS"
    assert assistant_message.content == "Discuss expectations with the team."

    retry_response = await client.post(f"/api/v1/messages/{assistant_message.id}/retry")
    assert retry_response.status_code == 200
    assert retry_response.json()["message"]["status"] == "PENDING"


@pytest.mark.asyncio
async def test_create_message_rejects_soft_deleted_file(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="deleted.txt",
        stored_filename="deleted.txt",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/deleted.txt",
        mime_type="text/plain",
        file_size_bytes=64,
        processing_status=FileProcessingStatus.READY,
    )
    session.add_all([conversation, file])
    await session.flush()
    file.deleted_at = conversation.created_at
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={"content": "Use this file", "file_ids": [str(file.id)]},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


@pytest.mark.asyncio
async def test_create_message_rejects_too_many_file_ids(client: AsyncClient) -> None:
    response = await client.post(
        f"/api/v1/conversations/{uuid4()}/messages",
        json={
            "content": "Use these files.",
            "file_ids": [str(uuid4()) for _ in range(MAX_FILE_IDS_PER_CHAT_CONTEXT + 1)],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_create_message_rejects_overlong_content(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    session.add(conversation)
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={"content": "a" * (MAX_MESSAGE_CONTENT_LENGTH + 1), "file_ids": []},
    )

    messages = list(await session.scalars(select(Message)))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert messages == []


@pytest.mark.asyncio
async def test_create_message_rejects_unknown_fields(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    session.add(conversation)
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={"content": "Valid question.", "file_ids": [], "unexpected": "ignored?"},
    )

    messages = list(await session.scalars(select(Message)))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert messages == []


@pytest.mark.asyncio
async def test_create_message_rejects_whitespace_only_content(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    session.add(conversation)
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={"content": "   \n\t", "file_ids": []},
    )

    messages = list(await session.scalars(select(Message)))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert messages == []


@pytest.mark.asyncio
async def test_create_message_rejects_too_many_preselected_files(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
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
            for file in files
        ]
    )
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={"content": "Use selected files.", "file_ids": []},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "FILE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_retry_rejects_generating_assistant_message(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    session.add(conversation)
    await session.flush()
    assistant_message = Message(
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        content="Partial answer",
        status=MessageStatus.GENERATING,
        sequence_no=1,
    )
    session.add(assistant_message)
    await session.commit()

    response = await client.post(f"/api/v1/messages/{assistant_message.id}/retry")
    await session.refresh(assistant_message)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_MESSAGE_STATUS"
    assert assistant_message.content == "Partial answer"
    assert assistant_message.status == MessageStatus.GENERATING


@pytest.mark.asyncio
async def test_create_message_ignores_stale_conversation_file_link(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="deleted.txt",
        stored_filename="deleted.txt",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/deleted.txt",
        mime_type="text/plain",
        file_size_bytes=64,
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
    file.deleted_at = conversation.created_at
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={"content": "No active files should be used.", "file_ids": []},
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_message_does_not_inherit_prior_message_files(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    prior_file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="Prior.txt",
        stored_filename="prior.txt",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/prior.txt",
        mime_type="text/plain",
        file_size_bytes=64,
        processing_status=FileProcessingStatus.READY,
    )
    preselected_file = File(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="Preselected.txt",
        stored_filename="preselected.txt",
        storage_base_url="http://localhost:9000/capstone-files/",
        storage_path="supervisors/dev/files/preselected.txt",
        mime_type="text/plain",
        file_size_bytes=64,
        processing_status=FileProcessingStatus.READY,
    )
    session.add_all([conversation, prior_file, preselected_file])
    await session.flush()
    prior_message = Message(
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content="Prior question",
        status=MessageStatus.COMPLETED,
        sequence_no=1,
    )
    session.add(prior_message)
    await session.flush()
    session.add_all(
        [
            MessageFile(
                conversation_id=conversation.id,
                message_id=prior_message.id,
                file_id=prior_file.id,
            ),
            MessageFile(
                conversation_id=conversation.id,
                message_id=None,
                file_id=preselected_file.id,
            ),
        ]
    )
    await session.commit()

    response = await client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        json={"content": "Use only preselected files.", "file_ids": []},
    )

    user_message_id = UUID(response.json()["user_message"]["id"])
    attached_file_ids = list(
        await session.scalars(
            select(MessageFile.file_id)
            .where(MessageFile.message_id == user_message_id)
            .order_by(MessageFile.file_id)
        )
    )
    assert response.status_code == 201
    assert attached_file_ids == [preselected_file.id]


@pytest.mark.asyncio
async def test_openapi_documents_message_stream_as_sse(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    stream_response = response.json()["paths"]["/api/v1/messages/{message_id}/stream"]["get"][
        "responses"
    ]["200"]
    assert "text/event-stream" in stream_response["content"]
