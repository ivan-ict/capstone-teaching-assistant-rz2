from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import Settings
from app.common.db_models import (
    Conversation,
    DocumentChunk,
    File,
    FileProcessingStatus,
    Message,
    MessageFile,
    MessageRole,
    MessageStatus,
    Project,
)
from tests.conftest import DEV_SUPERVISOR_ID, OTHER_SUPERVISOR_ID
from tests.integration.messages.test_message_api import FakeEmbeddingProvider


@pytest.fixture
def captured_chat(monkeypatch: pytest.MonkeyPatch):
    calls = []

    class Chat:
        def __init__(self, settings):
            pass

        async def stream_answer(self, system_prompt, chat_history, user_prompt):
            calls.append((system_prompt, chat_history))
            yield "A preserved answer."

    monkeypatch.setattr("app.modules.messages.message_service.OllamaChatProvider", Chat)
    monkeypatch.setattr(
        "app.modules.messages.message_service.OllamaEmbeddingProvider", FakeEmbeddingProvider
    )
    return calls


async def ask(client: AsyncClient, conversation_id: UUID):
    response = await client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": "Explain the project milestone.", "file_ids": []},
    )
    assert response.status_code == 201
    result = response.json()
    streamed = await client.get(result["stream_url"])
    assert "event: complete" in streamed.text
    return result


async def add_knowledge(session: AsyncSession, conversation: Conversation, marker: str):
    message = Message(
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content=f"{marker} message",
        sequence_no=100,
        status=MessageStatus.COMPLETED,
        embedding=[0.1] * 1024,
    )
    file = File(
        supervisor_id=conversation.supervisor_id,
        original_filename=f"{marker}.txt",
        stored_filename=f"{marker}.txt",
        storage_base_url="http://localhost/",
        storage_path=f"{marker}.txt",
        mime_type="text/plain",
        file_size_bytes=20,
        processing_status=FileProcessingStatus.READY,
    )
    session.add_all([message, file])
    await session.flush()
    association = MessageFile(conversation_id=conversation.id, file_id=file.id)
    chunk = DocumentChunk(
        file_id=file.id, chunk_index=0, content=f"{marker} document", embedding=[0.1] * 1024
    )
    session.add_all([association, chunk])
    await session.commit()
    return message, file, association, chunk


async def test_moves_and_retries_use_current_project_but_preserve_own_history(
    client: AsyncClient, session: AsyncSession, captured_chat
):
    projects = [
        Project(supervisor_id=DEV_SUPERVISOR_ID, name=name, instructions=f"{name} instruction")
        for name in ("ALPHA", "BETA")
    ]
    current = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Moving chat")
    session.add_all([*projects, current])
    await session.flush()
    for project in projects:
        sibling = Conversation(supervisor_id=DEV_SUPERVISOR_ID, project_id=project.id)
        session.add(sibling)
        await session.flush()
        await add_knowledge(session, sibling, project.name)

    for project in (None, *projects, None):
        moved = await client.patch(
            f"/api/v1/conversations/{current.id}/project",
            json={"project_id": str(project.id) if project else None},
        )
        assert moved.status_code == 200
        result = await ask(client, current.id)
        prompt, history = captured_chat[-1]
        for candidate in projects:
            assert (f"{candidate.name} instruction" in prompt) == (candidate is project)
            assert (f"{candidate.name} message" in prompt) == (candidate is project)
            assert (f"{candidate.name} document" in prompt) == (candidate is project)
        if project:
            assert ("ASSISTANT", "A preserved answer.") in history
            messages = await client.get(f"/api/v1/conversations/{current.id}/messages")
            assert messages.json()["items"][-1]["sources"][0]["original_filename"] == (
                f"{project.name}.txt"
            )

    await client.patch(
        f"/api/v1/conversations/{current.id}/project",
        json={"project_id": str(projects[0].id)},
    )
    retry = await client.post(f"/api/v1/messages/{result['assistant_message']['id']}/retry")
    assert retry.status_code == 200
    assert "event: complete" in (await client.get(retry.json()["stream_url"])).text
    assert "ALPHA instruction" in captured_chat[-1][0]

    for instructions in ("EDITED instruction", None):
        updated = await client.patch(
            f"/api/v1/projects/{projects[0].id}", json={"instructions": instructions}
        )
        assert updated.status_code == 200
        await ask(client, current.id)
        assert "ALPHA instruction" not in captured_chat[-1][0]
        assert ("EDITED instruction" in captured_chat[-1][0]) == bool(instructions)

    assert (await client.delete(f"/api/v1/projects/{projects[0].id}")).status_code == 204
    await ask(client, current.id)
    assert "ALPHA message" not in captured_chat[-1][0]
    assert "ALPHA document" not in captured_chat[-1][0]


@pytest.mark.parametrize(
    "excluded",
    [
        "other_project",
        "other_owner",
        "deleted_conversation",
        "deleted_message",
        "failed_message",
        "empty_message",
        "unembedded_message",
        "future_message",
        "deleted_file",
        "unready_file",
        "removed_association",
        "deleted_chunk",
        "foreign_file",
    ],
)
async def test_project_retrieval_excludes_ineligible_knowledge(
    client: AsyncClient, session: AsyncSession, captured_chat, excluded: str
):
    project = Project(supervisor_id=DEV_SUPERVISOR_ID, name="Shared")
    session.add(project)
    await session.flush()
    current = Conversation(supervisor_id=DEV_SUPERVISOR_ID, project_id=project.id)
    sibling = Conversation(supervisor_id=DEV_SUPERVISOR_ID, project_id=project.id)
    session.add_all([current, sibling])
    await session.flush()
    message, file, association, chunk = await add_knowledge(session, sibling, "EXCLUDED")
    now = datetime.now(UTC)
    if excluded == "other_project":
        sibling.project_id = None
    elif excluded == "other_owner":
        sibling.supervisor_id = OTHER_SUPERVISOR_ID
    elif excluded == "deleted_conversation":
        sibling.deleted_at = now
    elif excluded == "deleted_message":
        message.deleted_at = now
    elif excluded == "failed_message":
        message.status = MessageStatus.FAILED
    elif excluded == "empty_message":
        message.content = ""
    elif excluded == "unembedded_message":
        message.embedding = None
    elif excluded == "future_message":
        message.created_at = now + timedelta(days=1)
    elif excluded == "deleted_file":
        file.deleted_at = now
    elif excluded == "unready_file":
        file.processing_status = FileProcessingStatus.FAILED
    elif excluded == "removed_association":
        association.deleted_at = now
    elif excluded == "deleted_chunk":
        chunk.deleted_at = now
    elif excluded == "foreign_file":
        file.supervisor_id = OTHER_SUPERVISOR_ID
    await session.commit()
    await ask(client, current.id)
    prompt = captured_chat[-1][0]
    if excluded in {"other_project", "other_owner", "deleted_conversation"}:
        assert "EXCLUDED" not in prompt
    elif excluded.endswith("message"):
        assert "EXCLUDED message" not in prompt
        assert "EXCLUDED document" in prompt
    else:
        assert "EXCLUDED document" not in prompt
        assert "EXCLUDED message" in prompt


async def test_moving_sibling_transfers_retrieval_without_copying_attachments(
    client: AsyncClient, session: AsyncSession, captured_chat
):
    projects = [Project(supervisor_id=DEV_SUPERVISOR_ID, name=name) for name in ("A", "B")]
    session.add_all(projects)
    await session.flush()
    chats = [Conversation(supervisor_id=DEV_SUPERVISOR_ID, project_id=p.id) for p in projects]
    sibling = Conversation(supervisor_id=DEV_SUPERVISOR_ID, project_id=projects[0].id)
    session.add_all([*chats, sibling])
    await session.flush()
    await add_knowledge(session, sibling, "MOVING")
    for destination in (projects[0].id, projects[1].id, None):
        response = await client.patch(
            f"/api/v1/conversations/{sibling.id}/project",
            json={"project_id": str(destination) if destination else None},
        )
        assert response.status_code == 200
        for project, chat in zip(projects, chats, strict=True):
            await ask(client, chat.id)
            prompt = captured_chat[-1][0]
            assert ("MOVING message" in prompt) == (project.id == destination)
            assert ("MOVING document" in prompt) == (project.id == destination)
    await ask(client, sibling.id)
    assert "MOVING document" in captured_chat[-1][0]
    assert ("USER", "MOVING message") in captured_chat[-1][1]


async def test_project_retrieval_keeps_limits_attachment_priority_and_unique_sources(
    client: AsyncClient, session: AsyncSession, captured_chat, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(
        "app.modules.messages.message_service.get_settings", lambda: Settings(rag_top_k=1)
    )
    project = Project(supervisor_id=DEV_SUPERVISOR_ID, name="Shared")
    session.add(project)
    await session.flush()
    current = Conversation(supervisor_id=DEV_SUPERVISOR_ID, project_id=project.id)
    sibling = Conversation(supervisor_id=DEV_SUPERVISOR_ID, project_id=project.id)
    session.add_all([current, sibling])
    await session.flush()
    own_message, own_file, _, own_chunk = await add_knowledge(session, current, "OWN")
    await add_knowledge(session, sibling, "SIBLING")
    # A worse chunk index makes the attachment win only through explicit priority on SQLite.
    own_chunk.chunk_index = 10
    session.add(MessageFile(conversation_id=sibling.id, file_id=own_file.id))
    await session.commit()
    response = await client.post(
        f"/api/v1/conversations/{current.id}/messages",
        json={"content": "Use my attachment", "file_ids": [str(own_file.id)]},
    )
    assert response.status_code == 201
    assert "event: complete" in (await client.get(response.json()["stream_url"])).text
    prompt, history = captured_chat[-1]
    assert ("USER", own_message.content) in history
    assert own_message.content not in prompt
    assert "SIBLING message" in prompt
    assert prompt.count("OWN document") == 1
    assert "SIBLING document" not in prompt
    messages = await client.get(f"/api/v1/conversations/{current.id}/messages")
    sources = messages.json()["items"][-1]["sources"]
    assert len(sources) == 1
    assert sources[0]["file_id"] == str(own_file.id)
