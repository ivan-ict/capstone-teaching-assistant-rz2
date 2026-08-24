from collections.abc import AsyncIterator
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import Conversation, Message, MessageStatus
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
        return [[0.1, 0.2, 0.3] for _text in texts]

    async def embed_query(self, text: str) -> list[float]:
        return [0.1, 0.2, 0.3]


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

    retry_response = await client.post(f"/api/v1/messages/{assistant_message.id}/retry")
    assert retry_response.status_code == 200
    assert retry_response.json()["message"]["status"] == "PENDING"
