from dataclasses import dataclass
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.common.ai import OllamaChatProvider
from app.common.config import Settings


@dataclass
class FakeChunk:
    content: str


class FakeChatModel:
    def __init__(self) -> None:
        self.messages: list[Any] = []

    async def astream(self, messages: list[Any]):
        self.messages = messages
        yield FakeChunk("done")


def test_ollama_chat_provider_forwards_generation_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_options: dict[str, Any] = {}

    def fake_chat_model(**options: Any) -> FakeChatModel:
        captured_options.update(options)
        return FakeChatModel()

    monkeypatch.setattr("app.common.ai.ChatOllama", fake_chat_model)

    OllamaChatProvider(
        Settings(
            ollama_chat_model="test-chat-model",
            ollama_base_url="http://ollama.test",
            ollama_chat_temperature=0.1,
            ollama_chat_num_predict=256,
            ollama_chat_num_ctx=4096,
            ollama_chat_reasoning=False,
            ollama_chat_keep_alive="10m",
            ollama_chat_num_thread=8,
            ollama_chat_num_gpu=1,
        )
    )

    assert captured_options == {
        "model": "test-chat-model",
        "base_url": "http://ollama.test",
        "temperature": 0.1,
        "num_predict": 256,
        "num_ctx": 4096,
        "reasoning": False,
        "keep_alive": "10m",
        "num_thread": 8,
        "num_gpu": 1,
    }


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
