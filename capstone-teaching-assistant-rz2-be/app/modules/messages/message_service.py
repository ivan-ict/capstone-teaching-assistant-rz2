import asyncio
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
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
from app.modules.messages.message_repository import MessageGenerationContext, MessageRepository


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
        creation_context = await self.repository.lock_message_creation_context(
            conversation_id, supervisor_id
        )
        if creation_context is None:
            raise NotFoundError("Conversation not found.")
        conversation, preselected_file_ids, user_sequence = creation_context

        unique_file_ids = list(dict.fromkeys([*preselected_file_ids, *file_ids]))
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
        files = (
            await self.repository.list_files_by_ids_for_supervisor(unique_file_ids, supervisor_id)
            if unique_file_ids
            else []
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

        user_message, assistant_message = await self.repository.add_message_pair(
            conversation_id,
            message_content,
            user_sequence,
            unique_file_ids,
        )
        if user_sequence == 1 and conversation.title == "New conversation":
            conversation.title = message_content[:42].strip()
            if len(message_content) > 42:
                conversation.title += "..."

        await self.session.commit()
        return MessageCreateResponseDTO(
            user_message=self._message_dto(user_message),
            assistant_message=self._message_dto(assistant_message),
            conversation_title=conversation.title,
            stream_url=f"/api/v1/messages/{assistant_message.id}/stream",
        )

    async def stream_assistant_response(
        self, generation_context: MessageGenerationContext
    ) -> AsyncIterator[str]:
        assistant_message = generation_context.assistant_message
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
            user_message = generation_context.user_message
            if user_message is None:
                raise ApiError("CHAT_CONTEXT_MISSING", "Assistant message has no user prompt.")

            embedding_task: asyncio.Task[list[float]] | None = None
            if user_message.embedding is None:
                embedding_task = asyncio.create_task(
                    self.embeddings.embed_query(user_message.content)
                )
            try:
                history = await self.repository.list_history_before(assistant_message)
                query_embedding = (
                    await embedding_task if embedding_task is not None else user_message.embedding
                )
            except BaseException:
                if embedding_task is not None:
                    if not embedding_task.done():
                        embedding_task.cancel()
                    await asyncio.gather(embedding_task, return_exceptions=True)
                raise
            if query_embedding is None:
                raise ApiError("INVALID_EMBEDDING", "User message embedding is missing.")
            self._validate_embedding(query_embedding)
            user_message.embedding = query_embedding

            context_rows = await self.repository.retrieve_chunks(
                generation_context,
                generation_context.file_ids,
                query_embedding,
                self.settings.rag_top_k,
            )
            context = [
                RetrievedChunkDTO(
                    chunk_id=chunk.id,
                    file_id=file.id,
                    original_filename=file.original_filename,
                    content=chunk.content,
                )
                for chunk, file in context_rows
            ]
            relevant_messages = await self.repository.retrieve_messages(
                generation_context,
                user_message.sequence_no,
                query_embedding,
                self.settings.rag_top_k,
                {message.id for message in history},
            )
            system_prompt = self._build_system_prompt(
                context,
                relevant_messages,
                generation_context.project_instructions,
            )
            chat_history = [
                (message.role.value, message.content)
                for message in history
                if message.id != user_message.id
            ]
            source_payloads = self._source_payloads(context)
            await self.session.commit()

            print(
                json.dumps(
                    {
                        "event": "chat_project_context",
                        "conversation_id": str(user_message.conversation_id),
                        "assistant_message_id": str(assistant_message.id),
                        "project_id": (
                            str(generation_context.project_id)
                            if generation_context.project_id is not None
                            else None
                        ),
                        "project_instructions": generation_context.project_instructions,
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )
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
            self.repository.set_message_state(
                assistant_message,
                assistant_content,
                MessageStatus.COMPLETED,
                assistant_embedding,
                source_payloads,
            )
            await self.session.commit()
            generation_finished = True
            yield self._sse(
                "complete",
                {
                    "message_id": str(assistant_message.id),
                    "status": MessageStatus.COMPLETED.value,
                    "sources": source_payloads,
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
        if assistant_message.status == MessageStatus.GENERATING:
            raise ApiError(
                "INVALID_MESSAGE_STATUS",
                "Assistant messages cannot be retried while generation is in progress.",
                status.HTTP_409_CONFLICT,
            )
        assistant_message = self.repository.set_message_state(
            assistant_message,
            "",
            MessageStatus.PENDING,
            None,
        )
        await self.session.commit()
        return MessageRetryResponseDTO(
            message=self._message_dto(assistant_message),
            stream_url=f"/api/v1/messages/{assistant_message.id}/stream",
        )

    async def prepare_assistant_stream(
        self, supervisor_id: UUID, message_id: UUID
    ) -> MessageGenerationContext:
        generation_context = await self.repository.get_message_generation_context(
            message_id, supervisor_id
        )
        if generation_context is None:
            raise NotFoundError("Message not found.")
        assistant_message = generation_context.assistant_message
        if assistant_message.role != MessageRole.ASSISTANT:
            raise ApiError(
                "INVALID_MESSAGE_ROLE", "Only Assistant messages can be streamed or retried."
            )
        self._ensure_pending_assistant_message(assistant_message)
        return generation_context

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

    def _build_system_prompt(
        self,
        context: list[RetrievedChunkDTO],
        relevant_messages: list[Message],
        project_instructions: str | None,
    ) -> str:
        context_text = self.mcp_registry.format_retrieved_chunks(context)
        instructions = project_instructions or "No project-specific instructions were provided."
        current_time = datetime.now(UTC).isoformat()
        message_context = self._format_relevant_messages(relevant_messages)
        return "\n\n".join(
            [
                "You are a capstone teaching assistant for university supervisors.",
                (
                    "Answer clearly, use retrieved document context when it is relevant, "
                    "and say when context is insufficient."
                ),
                (
                    "When using Markdown tables, follow GitHub-Flavored Markdown exactly: "
                    "place a delimiter row immediately after the header and use at least "
                    "three hyphens in every delimiter cell, for example | :--- | :--- |."
                ),
                f"Current UTC date and time: {current_time}",
                f"*IMPORTANT* MUST follow these project instructions when responding:\n{instructions}",
                f"Relevant prior messages:\n{message_context}",
                f"Retrieved context:\n{context_text}",
            ]
        )

    def _format_relevant_messages(self, messages: list[Message]) -> str:
        if not messages:
            return "No semantically relevant prior messages were found."
        return "\n\n".join(
            f"[Conversation {message.conversation_id}, "
            f"{message.role.value} #{message.sequence_no}]\n{message.content}"
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
        self.repository.set_message_state(
            assistant_message,
            "".join(collected_tokens),
            MessageStatus.FAILED,
            None,
        )
        await self.session.commit()
