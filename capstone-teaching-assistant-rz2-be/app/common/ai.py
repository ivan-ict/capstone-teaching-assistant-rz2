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
            if role == "USER":
                messages.append(HumanMessage(content=content))
            else:
                messages.append(AIMessage(content=content))
        messages.append(HumanMessage(content=user_prompt))

        async for chunk in self._chat.astream(messages):
            if isinstance(chunk.content, str):
                yield chunk.content
