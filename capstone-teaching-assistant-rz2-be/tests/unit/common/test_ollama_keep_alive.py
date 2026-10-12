from typing import Any

import pytest

from app.common.ai import (
    OllamaChatProvider,
    OllamaEmbeddingProvider,
    OllamaImageDescriptionProvider,
    chat_keep_alive,
    keep_alive_seconds,
    preload_ollama_models,
)
from app.common.config import Settings


@pytest.mark.parametrize(
    ("value", "expected"),
    [(-1, -1), ("-1", -1), ("30m", 1800), ("2h", 7200), ("45s", 45), (600, 600)],
)
def test_keep_alive_seconds(value: int | str, expected: int) -> None:
    assert keep_alive_seconds(value) == expected


def test_providers_use_shared_keep_alive() -> None:
    settings = Settings(ollama_keep_alive=-1, ollama_chat_keep_alive=None)

    assert OllamaEmbeddingProvider(settings)._embeddings.keep_alive == -1
    assert OllamaImageDescriptionProvider(settings)._chat.keep_alive == -1
    assert OllamaChatProvider(settings)._chat.keep_alive == -1


def test_chat_keep_alive_override() -> None:
    assert chat_keep_alive(Settings(ollama_keep_alive=-1, ollama_chat_keep_alive="10m")) == "10m"
    assert chat_keep_alive(Settings(ollama_keep_alive=-1, ollama_chat_keep_alive=None)) == -1


class RecordingClient:
    def __init__(self, fail: bool = False) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.fail = fail

    async def generate(self, **kwargs: Any) -> None:
        self.calls.append(("generate", kwargs))
        if self.fail:
            raise ConnectionError("ollama is down")

    async def embed(self, **kwargs: Any) -> None:
        self.calls.append(("embed", kwargs))
        if self.fail:
            raise ConnectionError("ollama is down")


async def test_preload_loads_every_model_with_keep_alive() -> None:
    settings = Settings(
        ollama_chat_model="chat",
        ollama_vision_model="vision",
        ollama_embedding_model="embed",
        ollama_keep_alive=-1,
        ollama_chat_keep_alive=None,
        ollama_chat_num_ctx=8192,
        ollama_chat_num_gpu=None,
        ollama_chat_num_thread=None,
    )
    client = RecordingClient()

    await preload_ollama_models(settings, client)  # type: ignore[arg-type]

    assert [(kind, call["model"], call["keep_alive"]) for kind, call in client.calls] == [
        ("generate", "chat", -1),
        ("generate", "vision", -1),
        ("embed", "embed", -1),
    ]
    assert client.calls[0][1]["options"] == {"num_ctx": 8192}
    assert client.calls[1][1]["options"] == {"num_ctx": settings.ollama_vision_num_ctx}


async def test_preload_swallows_connection_errors() -> None:
    client = RecordingClient(fail=True)

    await preload_ollama_models(Settings(), client)  # type: ignore[arg-type]

    assert len(client.calls) == 3


def test_keep_alive_from_env_is_sent_as_a_number(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OLLAMA_KEEP_ALIVE", "-1")
    monkeypatch.setenv("OLLAMA_CHAT_KEEP_ALIVE", "30m")

    settings = Settings()

    assert settings.ollama_keep_alive == -1
    assert isinstance(settings.ollama_keep_alive, int)
    assert settings.ollama_chat_keep_alive == "30m"
    assert OllamaImageDescriptionProvider(settings)._chat.keep_alive == -1


async def test_preload_sends_numeric_keep_alive_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OLLAMA_KEEP_ALIVE", "-1")
    monkeypatch.setenv("OLLAMA_CHAT_KEEP_ALIVE", "")
    client = RecordingClient()

    await preload_ollama_models(Settings(), client)  # type: ignore[arg-type]

    assert [call["keep_alive"] for _, call in client.calls] == [-1, -1, -1]
