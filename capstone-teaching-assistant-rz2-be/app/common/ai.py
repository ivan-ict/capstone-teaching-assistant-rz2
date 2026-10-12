import asyncio
import base64
import io
import logging
from collections.abc import AsyncIterator, Awaitable
from typing import Protocol

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama, OllamaEmbeddings
from ollama import AsyncClient
from PIL import Image, ImageOps, UnidentifiedImageError

from app.common.config import Settings

logger = logging.getLogger(__name__)


def chat_keep_alive(settings: Settings) -> int | str:
    if settings.ollama_chat_keep_alive is not None:
        return settings.ollama_chat_keep_alive
    return settings.ollama_keep_alive


_DURATION_UNITS = {"s": 1, "m": 60, "h": 3600}


def keep_alive_seconds(value: int | str) -> int:
    """Convert an Ollama keep-alive ("-1", "30m", "2h", 600) to seconds."""
    if isinstance(value, int):
        return value
    text = value.strip().lower()
    if text and text[-1] in _DURATION_UNITS:
        return int(float(text[:-1]) * _DURATION_UNITS[text[-1]])
    return int(text)


async def preload_ollama_models(settings: Settings, client: AsyncClient | None = None) -> None:
    """Load every model into Ollama memory so the first request has no load delay.

    Failures are logged and swallowed: the API must start even if Ollama is down.
    """
    client = client or AsyncClient(host=settings.ollama_base_url)
    llms = {
        settings.ollama_chat_model: chat_keep_alive(settings),
        settings.ollama_vision_model: settings.ollama_keep_alive,
    }

    # The chat model must be loaded with the same runner options chat requests
    # use (context size, GPU layers), otherwise Ollama reloads it on first chat.
    chat_options = {
        key: value
        for key, value in {
            "num_ctx": settings.ollama_chat_num_ctx,
            "num_gpu": settings.ollama_chat_num_gpu,
            "num_thread": settings.ollama_chat_num_thread,
        }.items()
        if value is not None
    }
    vision_options = {"num_ctx": settings.ollama_vision_num_ctx}
    # Load one model at a time so they do not compete for memory while loading.
    for model, keep_alive in llms.items():
        options = chat_options if model == settings.ollama_chat_model else vision_options
        await _preload(model, client.generate(model=model, keep_alive=keep_alive, options=options))
    embedding_model = settings.ollama_embedding_model
    await _preload(
        embedding_model,
        client.embed(model=embedding_model, input="warmup", keep_alive=settings.ollama_keep_alive),
    )


async def _preload(model: str, request: Awaitable[object]) -> None:
    try:
        await request
        logger.info("Preloaded Ollama model %s", model)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.warning("Could not preload Ollama model %s", model, exc_info=True)


class EmbeddingProvider(Protocol):
    async def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    async def embed_query(self, text: str) -> list[float]: ...


class ChatProvider(Protocol):
    def stream_answer(
        self,
        system_prompt: str,
        chat_history: list[tuple[str, str]],
        user_prompt: str,
    ) -> AsyncIterator[str]: ...


class ImageDescriptionProvider(Protocol):
    async def describe_image(self, content: bytes, mime_type: str) -> str: ...


class OllamaEmbeddingProvider:
    def __init__(self, settings: Settings) -> None:
        self._embeddings = OllamaEmbeddings(
            model=settings.ollama_embedding_model,
            base_url=settings.ollama_base_url,
            # OllamaEmbeddings only accepts integer seconds.
            keep_alive=keep_alive_seconds(settings.ollama_keep_alive),
        )

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embeddings.aembed_documents(texts)

    async def embed_query(self, text: str) -> list[float]:
        return await self._embeddings.aembed_query(text)


def downscale_image(content: bytes, mime_type: str, max_dimension: int) -> tuple[bytes, str]:
    """Shrink an image so its longest side is at most max_dimension.

    Returns the original bytes when the image is already small enough or cannot be read.
    """
    try:
        with Image.open(io.BytesIO(content)) as opened:
            image = ImageOps.exif_transpose(opened)
            if max(image.size) <= max_dimension:
                return content, mime_type
            image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            if mime_type == "image/jpeg":
                image.convert("RGB").save(output, format="JPEG", quality=90)
                return output.getvalue(), "image/jpeg"
            image.save(output, format="PNG")
            return output.getvalue(), "image/png"
    except UnidentifiedImageError, OSError, ValueError:
        logger.warning("Could not downscale image; sending original bytes", exc_info=True)
        return content, mime_type


class OllamaImageDescriptionProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._max_dimension = settings.image_max_dimension
        self._chat = ChatOllama(
            model=settings.ollama_vision_model,
            base_url=settings.ollama_base_url,
            temperature=0,
            keep_alive=settings.ollama_keep_alive,
            num_ctx=settings.ollama_vision_num_ctx,
            num_predict=settings.ollama_vision_num_predict,
        )
        self._retry_chat: ChatOllama | None = None

    def _get_retry_chat(self) -> ChatOllama:
        # qwen3-vl cannot turn thinking off and sometimes loops until num_predict
        # runs out. At temperature 0 a retry would loop identically, so the retry
        # adds randomness and a repeat penalty to break the loop.
        if self._retry_chat is None:
            settings = self._settings
            self._retry_chat = ChatOllama(
                model=settings.ollama_vision_model,
                base_url=settings.ollama_base_url,
                temperature=0.5,
                repeat_penalty=1.15,
                keep_alive=settings.ollama_keep_alive,
                num_ctx=settings.ollama_vision_num_ctx,
                num_predict=settings.ollama_vision_num_predict,
            )
        return self._retry_chat

    async def describe_image(self, content: bytes, mime_type: str) -> str:
        content, mime_type = await asyncio.to_thread(
            downscale_image, content, mime_type, self._max_dimension
        )
        image = base64.b64encode(content).decode("ascii")
        message = HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": (
                        "Describe this image as standalone text for document retrieval. Include "
                        "the visible subjects, setting, important details, spatial relationships, "
                        "diagram or chart structure, labels, and all legible text. State "
                        "uncertainty when a detail is unclear and do not infer facts that are "
                        "not visible."
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": f"data:{mime_type};base64,{image}",
                },
            ]
        )
        text, metadata = _extract(await self._chat.ainvoke([message]))
        if not text and metadata.get("done_reason") == "length":
            _log_empty_description(metadata, retrying=True)
            text, metadata = _extract(await self._get_retry_chat().ainvoke([message]))
        if not text:
            _log_empty_description(metadata, retrying=False)
            if metadata.get("done_reason") == "length":
                raise ImageDescriptionTruncatedError(
                    "The image model ran out of context while describing this image."
                )
        return text


def _extract(response: BaseMessage) -> tuple[str, dict[str, object]]:
    if isinstance(response.content, str):
        text = response.content.strip()
    else:
        text = "\n".join(
            str(block["text"]).strip()
            for block in response.content
            if isinstance(block, dict) and block.get("type") == "text" and block.get("text")
        ).strip()
    return text, getattr(response, "response_metadata", None) or {}


def _log_empty_description(metadata: dict[str, object], retrying: bool) -> None:
    logger.warning(
        "Image model returned no description%s: done_reason=%s prompt_tokens=%s output_tokens=%s",
        "; retrying image description" if retrying else "",
        metadata.get("done_reason"),
        metadata.get("prompt_eval_count"),
        metadata.get("eval_count"),
    )


class ImageDescriptionTruncatedError(RuntimeError):
    pass


class OllamaChatProvider:
    def __init__(self, settings: Settings) -> None:
        self._chat = ChatOllama(
            model=settings.ollama_chat_model,
            base_url=settings.ollama_base_url,
            temperature=settings.ollama_chat_temperature,
            num_predict=settings.ollama_chat_num_predict,
            num_ctx=settings.ollama_chat_num_ctx,
            reasoning=settings.ollama_chat_reasoning,
            keep_alive=chat_keep_alive(settings),
            num_thread=settings.ollama_chat_num_thread,
            num_gpu=settings.ollama_chat_num_gpu,
        )

    async def stream_answer(
        self,
        system_prompt: str,
        chat_history: list[tuple[str, str]],
        user_prompt: str,
    ) -> AsyncIterator[str]:
        messages: list[BaseMessage] = [SystemMessage(content=system_prompt)]
        for role, content in chat_history:
            role = role.upper()
            if role == "USER":
                messages.append(HumanMessage(content=content))
            elif role == "ASSISTANT":
                messages.append(AIMessage(content=content))
        messages.append(HumanMessage(content=user_prompt))

        async for chunk in self._chat.astream(messages):
            if isinstance(chunk.content, str):
                yield chunk.content
