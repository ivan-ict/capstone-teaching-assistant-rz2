import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.ai import (
    ChatProvider,
    EmbeddingProvider,
    OllamaChatProvider,
    OllamaEmbeddingProvider,
)
from app.common.config import Settings, get_settings
from app.common.db_models import FileProcessingStatus, Message, MessageRole, MessageStatus
from app.common.errors import ApiError, NotFoundError
from app.common.limits import MAX_FILE_IDS_PER_CHAT_CONTEXT
from app.modules.messages.message_mcp import MessageMcpToolRegistry
from app.modules.messages.message_model import (
    MessageCreateResponseDTO,
    MessageDTO,
    MessageRetryResponseDTO,
    RetrievedChunkDTO,
)
from app.modules.messages.message_repository import MessageRepository


class MessageService:
    def __init__(
        self,
        session: AsyncSession,
        repository: MessageRepository | None = None,
        chat: ChatProvider | None = None,
        embeddings: EmbeddingProvider | None = None,
        mcp_registry: MessageMcpToolRegistry | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.repository = repository or MessageRepository(session)
        self.chat = chat or OllamaChatProvider(self.settings)
        self.embeddings = embeddings or OllamaEmbeddingProvider(self.settings)
        self.mcp_registry = mcp_registry or MessageMcpToolRegistry()
        self.file_only_prompt = "Please analyze the attached files."

    async def create_message_pair(
        self,
        supervisor_id: UUID,
        conversation_id: UUID,
        content: str,
        file_ids: list[UUID],
    ) -> MessageCreateResponseDTO:
        conversation = await self.repository.lock_conversation_for_supervisor(
            conversation_id, supervisor_id
        )
        if conversation is None:
            raise NotFoundError("Conversation not found.")

        unique_file_ids = list(
            dict.fromkeys(
                [*await self.repository.list_preselected_file_ids(conversation_id), *file_ids]
            )
        )
        message_content = content or self.file_only_prompt
        if not content and not unique_file_ids:
            raise ApiError(
                "VALIDATION_ERROR",
                "Message content or files must be provided.",
                status.HTTP_422_UNPROCESSABLE_CONTENT,
            )
        if len(unique_file_ids) > MAX_FILE_IDS_PER_CHAT_CONTEXT:
            raise ApiError(
                "FILE_LIMIT_EXCEEDED",
                f"At most {MAX_FILE_IDS_PER_CHAT_CONTEXT} files can be used for one message.",
            )
        files = await self.repository.list_files_by_ids_for_supervisor(
            unique_file_ids, supervisor_id
        )
        if {file.id for file in files} != set(unique_file_ids):
            raise NotFoundError("File not found.")
        not_ready_files = [
            file.original_filename
            for file in files
            if file.processing_status != FileProcessingStatus.READY
        ]
        if not_ready_files:
            raise ApiError(
                "FILE_NOT_READY",
                f"Files are not ready for chat: {', '.join(not_ready_files)}.",
            )

        user_sequence = await self.repository.next_sequence_no(conversation_id)
        user_message = await self.repository.create_message(
            conversation_id,
            MessageRole.USER,
            message_content,
            MessageStatus.COMPLETED,
            user_sequence,
        )
        assistant_message = await self.repository.create_message(
            conversation_id,
            MessageRole.ASSISTANT,
            "",
            MessageStatus.PENDING,
            user_sequence + 1,
        )
        if unique_file_ids:
            await self.repository.associate_files_to_message(
                conversation_id, user_message.id, unique_file_ids
            )

        await self.session.commit()
        return MessageCreateResponseDTO(
            user_message=self._message_dto(user_message),
            assistant_message=self._message_dto(assistant_message),
            stream_url=f"/api/v1/messages/{assistant_message.id}/stream",
        )

    async def stream_assistant_response(
        self, supervisor_id: UUID, message_id: UUID
    ) -> AsyncIterator[str]:
        assistant_message = await self._get_assistant_message(supervisor_id, message_id)
        self._ensure_pending_assistant_message(assistant_message)
        if not await self.repository.claim_pending_assistant_message(assistant_message):
            yield self._sse(
                "error",
                {
                    "code": "INVALID_MESSAGE_STATUS",
                    "message": "Only pending Assistant messages can be streamed.",
                },
            )
            return
        collected_tokens: list[str] = []
        generation_finished = False
        await self.session.commit()
        try:
            yield self._sse("start", {"message_id": str(assistant_message.id)})
            user_message = await self.repository.previous_user_message(assistant_message)
            if user_message is None:
                raise ApiError("CHAT_CONTEXT_MISSING", "Assistant message has no user prompt.")

            query_embedding = await self.embeddings.embed_query(user_message.content)
            self._validate_embedding(query_embedding)
            await self.repository.set_message_embedding(user_message, query_embedding)
            context_rows = await self.repository.retrieve_chunks(
                await self.repository.list_message_file_ids(user_message.id),
                query_embedding,
                self.settings.rag_top_k,
            )
            context = self._retrieved_chunk_dtos(context_rows)
            relevant_messages = await self._retrieve_relevant_messages(
                user_message,
                query_embedding,
            )
            history = await self.repository.list_history_before(assistant_message)
            project_instructions = await self._project_instructions(
                assistant_message.conversation_id, supervisor_id
            )
            system_prompt = self._build_system_prompt(
                context,
                relevant_messages,
                project_instructions,
            )
            chat_history = [
                (message.role.value, message.content)
                for message in history
                if message.id not in {user_message.id, assistant_message.id}
            ]

            async for token in self.chat.stream_answer(
                system_prompt,
                chat_history,
                user_message.content,
            ):
                collected_tokens.append(token)
                yield self._sse("token", {"delta": token})

            assistant_content = "".join(collected_tokens)
            if not assistant_content.strip():
                raise ApiError("EMPTY_AI_RESPONSE", "AI response was empty.")
            assistant_embedding = (await self.embeddings.embed_documents([assistant_content]))[0]
            self._validate_embedding(assistant_embedding)
            await self.repository.set_message_embedding(assistant_message, assistant_embedding)
            await self.repository.set_message_state(
                assistant_message,
                assistant_content,
                MessageStatus.COMPLETED,
            )
            assistant_message.sources = self._source_payloads(context)
            await self.session.commit()
            generation_finished = True
            yield self._sse(
                "complete",
                {
                    "message_id": str(assistant_message.id),
                    "status": MessageStatus.COMPLETED.value,
                    "sources": self._source_payloads(context),
                },
            )
        except asyncio.CancelledError:
            if not generation_finished:
                await self._fail_assistant_generation(assistant_message, collected_tokens)
            raise
        except GeneratorExit:
            if not generation_finished:
                await self._fail_assistant_generation(assistant_message, collected_tokens)
            raise
        except Exception:
            await self._fail_assistant_generation(assistant_message, collected_tokens)
            yield self._sse(
                "error",
                {
                    "code": "AI_GENERATION_FAILED",
                    "message": "AI response generation failed.",
                },
            )

    async def retry_assistant_response(
        self, supervisor_id: UUID, message_id: UUID
    ) -> MessageRetryResponseDTO:
        assistant_message = await self._get_assistant_message(supervisor_id, message_id)
        self._ensure_retryable_assistant_message(assistant_message)
        assistant_message = await self.repository.set_message_state(
            assistant_message,
            "",
            MessageStatus.PENDING,
            clear_embedding=True,
        )
        await self.session.commit()
        return MessageRetryResponseDTO(
            message=self._message_dto(assistant_message),
            stream_url=f"/api/v1/messages/{assistant_message.id}/stream",
        )

    async def ensure_assistant_message(self, supervisor_id: UUID, message_id: UUID) -> None:
        await self._get_assistant_message(supervisor_id, message_id)

    async def ensure_streamable_assistant_message(
        self, supervisor_id: UUID, message_id: UUID
    ) -> None:
        assistant_message = await self._get_assistant_message(supervisor_id, message_id)
        self._ensure_pending_assistant_message(assistant_message)

    async def _retrieve_context(
        self, user_message: Message, query_embedding: list[float]
    ) -> list[RetrievedChunkDTO]:
        file_ids = await self.repository.list_message_file_ids(user_message.id)
        if not file_ids:
            return []
        retrieved = await self.repository.retrieve_chunks(
            file_ids,
            query_embedding,
            self.settings.rag_top_k,
        )
        return self._retrieved_chunk_dtos(retrieved)

    def _retrieved_chunk_dtos(self, retrieved: list[tuple[Any, Any]]) -> list[RetrievedChunkDTO]:
        return [
            RetrievedChunkDTO(
                chunk_id=chunk.id,
                file_id=file.id,
                original_filename=file.original_filename,
                content=chunk.content,
            )
            for chunk, file in retrieved
        ]

    def _source_payloads(self, sources: list[RetrievedChunkDTO]) -> list[dict[str, object]]:
        return [
            {
                "chunk_id": str(source.chunk_id),
                "file_id": str(source.file_id),
                "original_filename": source.original_filename,
                "content": source.content,
            }
            for source in sources
        ]

    async def _retrieve_relevant_messages(
        self, user_message: Message, query_embedding: list[float]
    ) -> list[Message]:
        return await self.repository.retrieve_messages(
            user_message.conversation_id,
            user_message.sequence_no,
            query_embedding,
            self.settings.rag_top_k,
        )

    async def _project_instructions(self, conversation_id: UUID, supervisor_id: UUID) -> str | None:
        conversation = await self.repository.get_conversation_for_supervisor(
            conversation_id, supervisor_id
        )
        if conversation is None or conversation.project is None:
            return None
        return conversation.project.instructions

    async def _get_assistant_message(self, supervisor_id: UUID, message_id: UUID) -> Message:
        message = await self.repository.get_message_for_supervisor(message_id, supervisor_id)
        if message is None:
            raise NotFoundError("Message not found.")
        if message.role != MessageRole.ASSISTANT:
            raise ApiError(
                "INVALID_MESSAGE_ROLE", "Only Assistant messages can be streamed or retried."
            )
        return message

    def _ensure_pending_assistant_message(self, message: Message) -> None:
        if message.status != MessageStatus.PENDING:
            raise ApiError(
                "INVALID_MESSAGE_STATUS",
                "Only pending Assistant messages can be streamed.",
                status.HTTP_409_CONFLICT,
            )

    def _ensure_retryable_assistant_message(self, message: Message) -> None:
        if message.status == MessageStatus.GENERATING:
            raise ApiError(
                "INVALID_MESSAGE_STATUS",
                "Assistant messages cannot be retried while generation is in progress.",
                status.HTTP_409_CONFLICT,
            )

    def _build_system_prompt(
        self,
        context: list[RetrievedChunkDTO],
        relevant_messages: list[Message],
        project_instructions: str | None,
    ) -> str:
        context_text = self.mcp_registry.format_retrieved_chunks(context)
        instructions = project_instructions or "No project-specific instructions were provided."
        message_context = self._format_relevant_messages(relevant_messages)
        return "\n\n".join(
            [
                "You are a capstone teaching assistant for university supervisors.",
                (
                    "Answer clearly, use retrieved document context when it is relevant, "
                    "and say when context is insufficient."
                ),
                f"Project instructions:\n{instructions}",
                f"Relevant prior messages:\n{message_context}",
                f"Retrieved context:\n{context_text}",
            ]
        )

    def _format_relevant_messages(self, messages: list[Message]) -> str:
        if not messages:
            return "No semantically relevant prior messages were found."
        return "\n\n".join(
            f"[{message.role.value} #{message.sequence_no}]\n{message.content}"
            for message in messages
        )

    def _message_dto(self, message: Message) -> MessageDTO:
        return MessageDTO(
            id=message.id,
            role=message.role,
            content=message.content,
            status=message.status,
            sequence_no=message.sequence_no,
            sources=[],
        )

    def _sse(self, event: str, data: dict[str, object]) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    def _validate_embedding(self, embedding: list[float]) -> None:
        if len(embedding) != self.settings.embedding_dimension:
            raise ApiError("INVALID_EMBEDDING", "Embedding dimension does not match settings.")

    async def _fail_assistant_generation(
        self, assistant_message: Message, collected_tokens: list[str]
    ) -> None:
        await self.session.rollback()
        await self.repository.set_message_state(
            assistant_message,
            "".join(collected_tokens),
            MessageStatus.FAILED,
            clear_embedding=True,
        )
        await self.session.commit()
