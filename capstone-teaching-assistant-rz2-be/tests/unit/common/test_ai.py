from dataclasses import dataclass
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.common.ai import OllamaChatProvider


@dataclass
class FakeChunk:
    content: str


class FakeChatModel:
    def __init__(self) -> None:
        self.messages: list[Any] = []

    async def astream(self, messages: list[Any]):
        self.messages = messages
        yield FakeChunk("done")


@pytest.mark.asyncio
async def test_ollama_chat_provider_preserves_assistant_history_role() -> None:
    model = FakeChatModel()
    provider: Any = object.__new__(OllamaChatProvider)
    provider._chat = model

    tokens = [
        token
        async for token in provider.stream_answer(
            "system prompt",
            [("USER", "Question"), ("ASSISTANT", "Previous answer")],
            "Next question",
        )
    ]

    assert tokens == ["done"]
    assert isinstance(model.messages[0], SystemMessage)
    assert isinstance(model.messages[1], HumanMessage)
    assert isinstance(model.messages[2], AIMessage)
    assert model.messages[2].content == "Previous answer"
