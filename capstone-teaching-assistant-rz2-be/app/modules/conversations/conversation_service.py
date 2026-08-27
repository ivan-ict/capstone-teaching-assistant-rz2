from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import FileProcessingStatus
from app.common.errors import ApiError, NotFoundError
from app.common.limits import MAX_FILE_IDS_PER_CHAT_CONTEXT
from app.modules.conversations.conversation_model import (
    ConversationDetailDTO,
    ConversationDTO,
    ConversationFileAssociationDTO,
    ConversationFileDTO,
    ConversationFileListDTO,
    ConversationFileSummaryDTO,
    ConversationListDTO,
    ConversationMessageDTO,
    ConversationMessageListDTO,
    ConversationMoveProjectResponseDTO,
    ConversationRenameResponseDTO,
    MessageFileDTO,
    ProjectSummaryDTO,
)
from app.modules.messages.message_model import MessageSourceDTO
from app.modules.conversations.conversation_repository import ConversationRepository


class ConversationService:
    def __init__(
        self, session: AsyncSession, repository: ConversationRepository | None = None
    ) -> None:
        self.session = session
        self.repository = repository or ConversationRepository(session)

    async def create_conversation(
        self, supervisor_id: UUID, project_id: UUID | None
    ) -> ConversationDTO:
        if project_id is not None:
            await self._ensure_project(supervisor_id, project_id)
        conversation = await self.repository.create(supervisor_id, project_id)
        await self.session.commit()
        return ConversationDTO.model_validate(conversation)

    async def list_conversations(
        self,
        supervisor_id: UUID,
        project_id: UUID | None,
        unprojected: bool,
        page: int = 1,
        page_size: int = 100,
        search: str | None = None,
    ) -> ConversationListDTO:
        if project_id is not None:
            await self._ensure_project(supervisor_id, project_id)
        conversations = await self.repository.list_conversations(
            supervisor_id,
            project_id,
            unprojected,
            page,
            page_size,
            search,
        )
        total = await self.repository.count_conversations(
            supervisor_id,
            project_id,
            unprojected,
            search,
        )
        return ConversationListDTO(
            items=[ConversationDTO.model_validate(conversation) for conversation in conversations],
            page=page,
            page_size=page_size,
            total=total,
        )

    async def get_conversation(
        self, supervisor_id: UUID, conversation_id: UUID
    ) -> ConversationDetailDTO:
        conversation = await self._get_conversation(supervisor_id, conversation_id)
        return ConversationDetailDTO(
            id=conversation.id,
            project=(
                ProjectSummaryDTO(id=conversation.project.id, name=conversation.project.name)
                if conversation.project
                else None
            ),
            title=conversation.title,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
        )

    async def rename_conversation(
        self, supervisor_id: UUID, conversation_id: UUID, title: str
    ) -> ConversationRenameResponseDTO:
        conversation = await self._get_conversation(supervisor_id, conversation_id)
        conversation = await self.repository.rename(conversation, title)
        await self.session.commit()
        return ConversationRenameResponseDTO(
            id=conversation.id,
            title=conversation.title,
            updated_at=conversation.updated_at,
        )

    async def move_conversation_to_project(
        self, supervisor_id: UUID, conversation_id: UUID, project_id: UUID | None
    ) -> ConversationMoveProjectResponseDTO:
        conversation = await self._get_conversation(supervisor_id, conversation_id)
        if project_id is not None:
            await self._ensure_project(supervisor_id, project_id)
        conversation = await self.repository.move_to_project(conversation, project_id)
        await self.session.commit()
        return ConversationMoveProjectResponseDTO(
            id=conversation.id,
            project_id=conversation.project_id,
            updated_at=conversation.updated_at,
        )

    async def delete_conversation(self, supervisor_id: UUID, conversation_id: UUID) -> None:
        conversation = await self._get_conversation(supervisor_id, conversation_id)
        await self.repository.delete(conversation)
        await self.session.commit()

    async def list_messages(
        self, supervisor_id: UUID, conversation_id: UUID
    ) -> ConversationMessageListDTO:
        await self._get_conversation(supervisor_id, conversation_id)
        messages = await self.repository.list_messages(conversation_id)
        return ConversationMessageListDTO(
            items=[
                ConversationMessageDTO(
                    id=message.id,
                    role=message.role,
                    content=message.content,
                    status=message.status,
                    sequence_no=message.sequence_no,
                    files=[
                        MessageFileDTO(
                            id=message_file.file.id,
                            original_filename=message_file.file.original_filename,
                            mime_type=message_file.file.mime_type,
                        )
                        for message_file in message.files
                        if message_file.deleted_at is None and message_file.file.deleted_at is None
                    ],
                    sources=[
                        MessageSourceDTO(
                            chunk_id=source.get("chunk_id"),
                            file_id=source["file_id"],
                            original_filename=str(source["original_filename"]),
                            content=str(source["content"]),
                        )
                        for source in (message.sources or [])
                    ],
                    created_at=message.created_at,
                )
                for message in messages
            ]
        )

    async def list_files(
        self, supervisor_id: UUID, conversation_id: UUID
    ) -> ConversationFileListDTO:
        await self._get_conversation(supervisor_id, conversation_id)
        files = await self.repository.list_files(conversation_id, supervisor_id)
        return ConversationFileListDTO(
            items=[
                ConversationFileDTO(
                    id=file.id,
                    original_filename=file.original_filename,
                    mime_type=file.mime_type,
                    file_size_bytes=file.file_size_bytes,
                    processing_status=file.processing_status,
                )
                for file in files
            ]
        )

    async def associate_files(
        self, supervisor_id: UUID, conversation_id: UUID, file_ids: list[UUID]
    ) -> ConversationFileAssociationDTO:
        await self._get_conversation(supervisor_id, conversation_id)
        unique_file_ids = list(dict.fromkeys(file_ids))
        preselected_file_ids = set(await self.repository.list_preselected_file_ids(conversation_id))
        if len(preselected_file_ids | set(unique_file_ids)) > MAX_FILE_IDS_PER_CHAT_CONTEXT:
            raise ApiError(
                "FILE_LIMIT_EXCEEDED",
                (
                    f"At most {MAX_FILE_IDS_PER_CHAT_CONTEXT} files can be associated "
                    "with a conversation."
                ),
            )
        files = await self.repository.list_files_by_ids_for_supervisor(
            unique_file_ids,
            supervisor_id,
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
        files = await self.repository.associate_files_to_conversation(conversation_id, files)
        await self.session.commit()
        return ConversationFileAssociationDTO(
            conversation_id=conversation_id,
            files=[
                ConversationFileSummaryDTO(
                    id=file.id,
                    original_filename=file.original_filename,
                )
                for file in files
            ],
        )

    async def dissociate_file(
        self, supervisor_id: UUID, conversation_id: UUID, file_id: UUID
    ) -> None:
        await self._get_conversation(supervisor_id, conversation_id)
        removed = await self.repository.dissociate_preselected_file(conversation_id, file_id)
        if not removed:
            raise NotFoundError("Conversation file association not found.")
        await self.session.commit()

    async def _get_conversation(self, supervisor_id: UUID, conversation_id: UUID) -> Any:
        conversation = await self.repository.get_for_supervisor(conversation_id, supervisor_id)
        if conversation is None:
            raise NotFoundError("Conversation not found.")
        return conversation

    async def _ensure_project(self, supervisor_id: UUID, project_id: UUID) -> None:
        if not await self.repository.project_exists_for_supervisor(project_id, supervisor_id):
            raise NotFoundError("Project not found.")
