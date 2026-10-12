from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import NotFoundError
from app.modules.conversations.conversation_model import (
    ConversationDTO,
    ConversationListDTO,
    ConversationMessageDTO,
    ConversationMessageListDTO,
)
from app.modules.conversations.conversation_repository import ConversationRepository
from app.modules.semesters.semester_service import SemesterService


class ConversationService:
    def __init__(self, session: AsyncSession, repository: ConversationRepository | None = None):
        self.session = session
        self.repository = repository or ConversationRepository(session)

    async def create_conversation(self, supervisor_id: UUID) -> ConversationDTO:
        semester = await SemesterService(self.session).current(supervisor_id, writable=True)
        conversation = await self.repository.create(supervisor_id, semester.id)
        await self.session.commit()
        return ConversationDTO.model_validate(conversation)

    async def list_conversations(
        self, supervisor_id: UUID, page: int = 1, page_size: int = 100, search: str | None = None
    ) -> ConversationListDTO:
        items, total = await self.repository.list_conversations(
            supervisor_id, page, page_size, search
        )
        return ConversationListDTO(
            items=[ConversationDTO.model_validate(c) for c in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_conversation(self, supervisor_id: UUID, conversation_id: UUID) -> ConversationDTO:
        return ConversationDTO.model_validate(
            await self._get_conversation(supervisor_id, conversation_id)
        )

    async def rename_conversation(
        self, supervisor_id: UUID, conversation_id: UUID, title: str
    ) -> ConversationDTO:
        semester = await SemesterService(self.session).current(supervisor_id, lock=True)
        conversation = await self._get_conversation(supervisor_id, conversation_id)
        SemesterService.ensure_active(semester)
        conversation.title = title
        await self.session.commit()
        return ConversationDTO.model_validate(conversation)

    async def delete_conversation(self, supervisor_id: UUID, conversation_id: UUID) -> None:
        semester = await SemesterService(self.session).current(supervisor_id, lock=True)
        conversation = await self._get_conversation(supervisor_id, conversation_id)
        SemesterService.ensure_active(semester)
        await self.repository.delete(conversation)
        await self.session.commit()

    async def list_messages(
        self, supervisor_id: UUID, conversation_id: UUID
    ) -> ConversationMessageListDTO:
        await self._get_conversation(supervisor_id, conversation_id)
        messages = await self.repository.list_messages(conversation_id)
        return ConversationMessageListDTO(
            items=[ConversationMessageDTO.model_validate(m) for m in messages]
        )

    async def _get_conversation(self, supervisor_id: UUID, conversation_id: UUID):
        conversation = await self.repository.get_for_supervisor(conversation_id, supervisor_id)
        if conversation is None:
            raise NotFoundError("Conversation not found.")
        return conversation
