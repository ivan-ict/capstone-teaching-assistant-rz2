from dataclasses import dataclass
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.common.ai import OllamaChatProvider, OllamaImageDescriptionProvider
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

    async def ainvoke(self, messages: list[Any]):
        self.messages = messages
        return FakeChunk("A detailed image description.")


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


@pytest.mark.asyncio
async def test_image_description_provider_uses_dedicated_model_and_multimodal_input(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model = FakeChatModel()
    captured_options: dict[str, Any] = {}

    def fake_chat_model(**options: Any) -> FakeChatModel:
        captured_options.update(options)
        return model

    monkeypatch.setattr("app.common.ai.ChatOllama", fake_chat_model)
    provider = OllamaImageDescriptionProvider(
        Settings(
            ollama_vision_model="test-vision-model",
            ollama_base_url="http://ollama.test",
            ollama_keep_alive=-1,
            ollama_vision_num_ctx=16384,
            ollama_vision_num_predict=8192,
        )
    )

    description = await provider.describe_image(b"png bytes", "image/png")

    assert description == "A detailed image description."
    assert captured_options == {
        "model": "test-vision-model",
        "base_url": "http://ollama.test",
        "temperature": 0,
        "keep_alive": -1,
        "num_ctx": 16384,
        "num_predict": 8192,
    }
    assert isinstance(model.messages[0], HumanMessage)
    assert model.messages[0].content[1]["image_url"] == "data:image/png;base64,cG5nIGJ5dGVz"


def test_downscale_image_limits_longest_side() -> None:
    import io

    from PIL import Image

    from app.common.ai import downscale_image

    source = io.BytesIO()
    Image.new("RGB", (3000, 2000), "white").save(source, format="PNG")

    content, mime_type = downscale_image(source.getvalue(), "image/png", 1600)

    with Image.open(io.BytesIO(content)) as resized:
        assert max(resized.size) == 1600
        assert resized.size == (1600, 1067)
    assert mime_type == "image/png"


def test_downscale_image_keeps_small_and_unreadable_images() -> None:
    import io

    from PIL import Image

    from app.common.ai import downscale_image

    small = io.BytesIO()
    Image.new("RGB", (100, 50), "white").save(small, format="PNG")

    assert downscale_image(small.getvalue(), "image/png", 1600) == (small.getvalue(), "image/png")
    assert downscale_image(b"png bytes", "image/png", 1600) == (b"png bytes", "image/png")


@dataclass
class FakeResponse:
    content: str
    response_metadata: dict[str, Any]


class ScriptedVisionModel:
    """Returns the scripted responses in order, one per ainvoke call."""

    def __init__(self, responses: list[FakeResponse]) -> None:
        self.responses = responses
        self.options: list[dict[str, Any]] = []

    def __call__(self, **options: Any) -> ScriptedVisionModel:
        self.options.append(options)
        return self

    async def ainvoke(self, messages: list[Any]) -> FakeResponse:
        return self.responses.pop(0)


TRUNCATED = FakeResponse("", {"done_reason": "length", "eval_count": 8192})


@pytest.mark.asyncio
async def test_image_description_retries_with_loop_breaking_options(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model = ScriptedVisionModel([TRUNCATED, FakeResponse("A chart.", {"done_reason": "stop"})])
    monkeypatch.setattr("app.common.ai.ChatOllama", model)
    provider = OllamaImageDescriptionProvider(Settings())

    assert await provider.describe_image(b"png bytes", "image/png") == "A chart."
    assert model.options[1]["temperature"] == 0.5
    assert model.options[1]["repeat_penalty"] == 1.15


@pytest.mark.asyncio
async def test_image_description_raises_when_retry_is_also_truncated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.common.ai import ImageDescriptionTruncatedError

    monkeypatch.setattr("app.common.ai.ChatOllama", ScriptedVisionModel([TRUNCATED, TRUNCATED]))
    provider = OllamaImageDescriptionProvider(Settings())

    with pytest.raises(ImageDescriptionTruncatedError):
        await provider.describe_image(b"png bytes", "image/png")
