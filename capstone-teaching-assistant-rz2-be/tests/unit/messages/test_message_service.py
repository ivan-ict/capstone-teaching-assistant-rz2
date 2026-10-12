import asyncio
from collections.abc import AsyncGenerator, AsyncIterator
from typing import cast
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import Settings
from app.common.db_models import Conversation, Message, MessageRole, MessageStatus
from app.modules.messages.message_repository import MessageRepository
from app.modules.messages.message_service import MessageService
from tests.conftest import DEV_SEMESTER_ID, DEV_SUPERVISOR_ID


class FakeChat:
    def __init__(self) -> None:
        self.system_prompt: str | None = None
        self.chat_history: list[tuple[str, str]] | None = None

    async def stream_answer(
        self,
        system_prompt: str,
        chat_history: list[tuple[str, str]],
        user_prompt: str,
    ) -> AsyncIterator[str]:
        self.system_prompt = system_prompt
        self.chat_history = chat_history
        yield "Use "
        yield "weekly check-ins."


class FakeEmbeddings:
    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[0.1] * 1024 for _text in texts]

    async def embed_query(self, text: str) -> list[float]:
        return [0.1] * 1024


class CancellingChat:
    async def stream_answer(
        self,
        system_prompt: str,
        chat_history: list[tuple[str, str]],
        user_prompt: str,
    ) -> AsyncIterator[str]:
        yield "Partial "
        raise asyncio.CancelledError


class BlankChat:
    async def stream_answer(
        self,
        system_prompt: str,
        chat_history: list[tuple[str, str]],
        user_prompt: str,
    ) -> AsyncIterator[str]:
        yield "   "


async def prepared_stream(service: MessageService, message_id: UUID) -> AsyncIterator[str]:
    generation_context = await service.prepare_assistant_stream(DEV_SUPERVISOR_ID, message_id)
    return service.stream_assistant_response(generation_context)


@pytest.mark.asyncio
async def test_create_message_pair_then_stream_and_retry(session: AsyncSession) -> None:
    conversation = Conversation(
        semester_id=DEV_SEMESTER_ID, supervisor_id=DEV_SUPERVISOR_ID, title="Team issues"
    )
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
    )

    assert created.user_message.sequence_no == 1
    assert created.assistant_message.sequence_no == 2
    assert created.assistant_message.status == MessageStatus.PENDING

    events = [event async for event in await prepared_stream(service, created.assistant_message.id)]

    assert "event: complete" in events[-1]

    assistant_message = await session.get(Message, created.assistant_message.id)
    assert assistant_message is not None
    assert assistant_message.embedding is not None

    retry = await service.retry_assistant_response(DEV_SUPERVISOR_ID, created.assistant_message.id)

    await session.refresh(assistant_message)
    assert retry.message.status == MessageStatus.PENDING
    assert retry.message.content == ""
    assert assistant_message.embedding is None


@pytest.mark.asyncio
async def test_stream_uses_only_completed_non_empty_history(session: AsyncSession) -> None:
    conversation = Conversation(
        semester_id=DEV_SEMESTER_ID, supervisor_id=DEV_SUPERVISOR_ID, title="Team issues"
    )
    session.add(conversation)
    await session.flush()
    session.add_all(
        [
            Message(
                conversation_id=conversation.id,
                role=MessageRole.USER,
                content="Previous complete question",
                status=MessageStatus.COMPLETED,
                sequence_no=1,
            ),
            Message(
                conversation_id=conversation.id,
                role=MessageRole.ASSISTANT,
                content="Partial failed answer",
                status=MessageStatus.FAILED,
                sequence_no=2,
            ),
            Message(
                conversation_id=conversation.id,
                role=MessageRole.ASSISTANT,
                content="",
                status=MessageStatus.PENDING,
                sequence_no=3,
            ),
        ]
    )
    await session.commit()
    chat = FakeChat()
    service = MessageService(
        session,
        chat=chat,
        embeddings=FakeEmbeddings(),
        settings=Settings(rag_top_k=2),
    )

    created = await service.create_message_pair(
        DEV_SUPERVISOR_ID,
        conversation.id,
        "New question",
    )

    events = [event async for event in await prepared_stream(service, created.assistant_message.id)]

    assert "event: complete" in events[-1]
    assert chat.chat_history == [("USER", "Previous complete question")]


@pytest.mark.asyncio
async def test_stream_excludes_current_prompt_from_relevant_prior_messages(
    session: AsyncSession,
) -> None:
    conversation = Conversation(
        semester_id=DEV_SEMESTER_ID, supervisor_id=DEV_SUPERVISOR_ID, title="Team issues"
    )
    session.add(conversation)
    await session.commit()
    chat = FakeChat()
    service = MessageService(
        session,
        chat=chat,
        embeddings=FakeEmbeddings(),
        settings=Settings(rag_top_k=2),
    )

    created = await service.create_message_pair(
        DEV_SUPERVISOR_ID,
        conversation.id,
        "Current prompt marker",
    )

    events = [event async for event in await prepared_stream(service, created.assistant_message.id)]

    assert "event: complete" in events[-1]
    assert chat.system_prompt is not None
    assert "Current prompt marker" not in chat.system_prompt


@pytest.mark.asyncio
async def test_claim_pending_assistant_message_is_single_use(session: AsyncSession) -> None:
    conversation = Conversation(
        semester_id=DEV_SEMESTER_ID, supervisor_id=DEV_SUPERVISOR_ID, title="Team issues"
    )
    session.add(conversation)
    await session.flush()
    assistant_message = Message(
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        content="",
        status=MessageStatus.PENDING,
        sequence_no=1,
    )
    session.add(assistant_message)
    await session.commit()

    repository = MessageRepository(session)

    assert await repository.claim_pending_assistant_message(assistant_message) is True
    await session.commit()
    assert assistant_message.status == MessageStatus.GENERATING

    assert await repository.claim_pending_assistant_message(assistant_message) is False


@pytest.mark.asyncio
async def test_stream_cancellation_marks_assistant_failed(session: AsyncSession) -> None:
    conversation = Conversation(
        semester_id=DEV_SEMESTER_ID, supervisor_id=DEV_SUPERVISOR_ID, title="Team issues"
    )
    session.add(conversation)
    await session.commit()
    service = MessageService(
        session,
        chat=CancellingChat(),
        embeddings=FakeEmbeddings(),
        settings=Settings(rag_top_k=2),
    )
    created = await service.create_message_pair(
        DEV_SUPERVISOR_ID,
        conversation.id,
        "How should I handle missed meetings?",
    )

    with pytest.raises(asyncio.CancelledError):
        _events = [
            event async for event in await prepared_stream(service, created.assistant_message.id)
        ]

    assistant_message = await session.get(Message, created.assistant_message.id)
    assert assistant_message is not None
    assert assistant_message.status == MessageStatus.FAILED
    assert assistant_message.content == "Partial "


@pytest.mark.asyncio
async def test_stream_blank_ai_response_marks_assistant_failed(session: AsyncSession) -> None:
    conversation = Conversation(
        semester_id=DEV_SEMESTER_ID, supervisor_id=DEV_SUPERVISOR_ID, title="Team issues"
    )
    session.add(conversation)
    await session.commit()
    service = MessageService(
        session,
        chat=BlankChat(),
        embeddings=FakeEmbeddings(),
        settings=Settings(rag_top_k=2),
    )
    created = await service.create_message_pair(
        DEV_SUPERVISOR_ID,
        conversation.id,
        "How should I handle missed meetings?",
    )

    events = [event async for event in await prepared_stream(service, created.assistant_message.id)]

    assistant_message = await session.get(Message, created.assistant_message.id)
    assert "event: error" in events[-1]
    assert assistant_message is not None
    assert assistant_message.status == MessageStatus.FAILED
    assert assistant_message.content == "   "


@pytest.mark.asyncio
async def test_stream_close_after_start_marks_assistant_failed(session: AsyncSession) -> None:
    conversation = Conversation(
        semester_id=DEV_SEMESTER_ID, supervisor_id=DEV_SUPERVISOR_ID, title="Team issues"
    )
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
    )

    stream = cast(AsyncGenerator[str], await prepared_stream(service, created.assistant_message.id))
    start_event = await anext(stream)
    await stream.aclose()

    assistant_message = await session.get(Message, created.assistant_message.id)
    assert "event: start" in start_event
    assert assistant_message is not None
    assert assistant_message.status == MessageStatus.FAILED
    assert assistant_message.content == ""


@pytest.mark.asyncio
async def test_stream_close_after_complete_keeps_assistant_completed(
    session: AsyncSession,
) -> None:
    conversation = Conversation(
        semester_id=DEV_SEMESTER_ID, supervisor_id=DEV_SUPERVISOR_ID, title="Team issues"
    )
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
    )

    stream = cast(AsyncGenerator[str], await prepared_stream(service, created.assistant_message.id))
    events: list[str] = []
    while True:
        event = await anext(stream)
        events.append(event)
        if "event: complete" in event:
            break
    await stream.aclose()

    assistant_message = await session.get(Message, created.assistant_message.id)
    assert "event: complete" in events[-1]
    assert assistant_message is not None
    assert assistant_message.status == MessageStatus.COMPLETED
    assert assistant_message.content == "Use weekly check-ins."


pytestmark = pytest.mark.usefixtures("assigned_profiles")


def test_source_payloads_hide_chunks_beyond_distance_threshold(session: AsyncSession) -> None:
    from app.modules.messages.message_model import RetrievedChunkDTO

    service = MessageService(
        session,
        chat=FakeChat(),
        embeddings=FakeEmbeddings(),
        settings=Settings(rag_source_max_distance=0.4),
    )
    file_id = UUID(int=1)
    chunks = [
        RetrievedChunkDTO(
            chunk_id=UUID(int=10),
            file_id=file_id,
            original_filename="a.pdf",
            mime_type="application/pdf",
            content="close",
            distance=0.2,
        ),
        RetrievedChunkDTO(
            chunk_id=UUID(int=11),
            file_id=file_id,
            original_filename="a.pdf",
            content="far",
            distance=0.9,
        ),
        RetrievedChunkDTO(
            chunk_id=UUID(int=12),
            file_id=file_id,
            original_filename="a.pdf",
            content="unknown",
            distance=None,
        ),
    ]

    payloads = service._source_payloads(chunks)

    assert [payload["content"] for payload in payloads] == ["close", "unknown"]
    assert payloads[0]["mime_type"] == "application/pdf"
