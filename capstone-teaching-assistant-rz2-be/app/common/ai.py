import base64
from collections.abc import AsyncIterator
from typing import Protocol

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama, OllamaEmbeddings

from app.common.config import Settings


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
        )

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embeddings.aembed_documents(texts)

    async def embed_query(self, text: str) -> list[float]:
        return await self._embeddings.aembed_query(text)


class OllamaImageDescriptionProvider:
    def __init__(self, settings: Settings) -> None:
        self._chat = ChatOllama(
            model=settings.ollama_vision_model,
            base_url=settings.ollama_base_url,
            temperature=0,
        )

    async def describe_image(self, content: bytes, mime_type: str) -> str:
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
        response = await self._chat.ainvoke([message])
        if isinstance(response.content, str):
            return response.content.strip()
        return "\n".join(
            str(block["text"]).strip()
            for block in response.content
            if isinstance(block, dict) and block.get("type") == "text" and block.get("text")
        ).strip()


class OllamaChatProvider:
    def __init__(self, settings: Settings) -> None:
        self._chat = ChatOllama(
            model=settings.ollama_chat_model,
            base_url=settings.ollama_base_url,
            temperature=settings.ollama_chat_temperature,
            num_predict=settings.ollama_chat_num_predict,
            num_ctx=settings.ollama_chat_num_ctx,
            reasoning=settings.ollama_chat_reasoning,
            keep_alive=settings.ollama_chat_keep_alive,
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
