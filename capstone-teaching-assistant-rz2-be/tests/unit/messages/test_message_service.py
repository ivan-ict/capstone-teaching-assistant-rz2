from collections.abc import AsyncIterator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import Settings
from app.common.db_models import Conversation, MessageStatus
from app.modules.messages.message_service import MessageService
from tests.conftest import DEV_SUPERVISOR_ID


class FakeChat:
    async def stream_answer(
        self,
        system_prompt: str,
        chat_history: list[tuple[str, str]],
        user_prompt: str,
    ) -> AsyncIterator[str]:
        yield "Use "
        yield "weekly check-ins."


class FakeEmbeddings:
    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[0.1, 0.2, 0.3] for _text in texts]

    async def embed_query(self, text: str) -> list[float]:
        return [0.1, 0.2, 0.3]


@pytest.mark.asyncio
async def test_create_message_pair_then_stream_and_retry(session: AsyncSession) -> None:
    conversation = Conversation(supervisor_id=DEV_SUPERVISOR_ID, title="Team issues")
    session.add(conversation)
    await session.commit()
    service = MessageService(
        session,
        chat=FakeChat(),
        embeddings=FakeEmbeddings(),
        settings=Settings(rag_top_k=2),
    )

    created = await service.create_message_pair(
        DEV_SUPERVISOR_ID,
        conversation.id,
        "How should I handle missed meetings?",
        [],
    )

    assert created.user_message.sequence_no == 1
    assert created.assistant_message.sequence_no == 2
    assert created.assistant_message.status == MessageStatus.PENDING

    events = [
        event
        async for event in service.stream_assistant_response(
            DEV_SUPERVISOR_ID, created.assistant_message.id
        )
    ]

    assert "event: complete" in events[-1]

    retry = await service.retry_assistant_response(DEV_SUPERVISOR_ID, created.assistant_message.id)

    assert retry.message.status == MessageStatus.PENDING
    assert retry.message.content == ""
