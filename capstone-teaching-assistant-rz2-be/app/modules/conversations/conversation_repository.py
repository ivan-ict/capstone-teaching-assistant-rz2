from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import Conversation, Message, SupervisorProfile


class ConversationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    def scope(self, supervisor_id: UUID):
        return (
            select(Conversation)
            .join(
                SupervisorProfile,
                and_(
                    SupervisorProfile.user_id == Conversation.supervisor_id,
                    SupervisorProfile.semester_id == Conversation.semester_id,
                ),
            )
            .where(
                Conversation.supervisor_id == supervisor_id,
                Conversation.deleted_at.is_(None),
                SupervisorProfile.deleted_at.is_(None),
            )
        )

    async def create(self, supervisor_id: UUID, semester_id: UUID) -> Conversation:
        conversation = Conversation(
            supervisor_id=supervisor_id, semester_id=semester_id, title="New conversation"
        )
        self.session.add(conversation)
        await self.session.flush()
        return conversation

    async def list_conversations(
        self, supervisor_id: UUID, page: int, page_size: int, search: str | None = None
    ):
        query = self.scope(supervisor_id)
        if search:
            message_match = (
                select(Message.id)
                .where(
                    Message.conversation_id == Conversation.id,
                    Message.deleted_at.is_(None),
                    Message.content.ilike(f"%{search}%"),
                )
                .exists()
            )
            query = query.where(or_(Conversation.title.ilike(f"%{search}%"), message_match))
        total = await self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = list(
            await self.session.scalars(
                query.order_by(Conversation.updated_at.desc(), Conversation.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        return items, total

    async def get_for_supervisor(
        self, conversation_id: UUID, supervisor_id: UUID
    ) -> Conversation | None:
        return await self.session.scalar(
            self.scope(supervisor_id).where(Conversation.id == conversation_id)
        )

    async def delete(self, conversation: Conversation) -> None:
        conversation.deleted_at = datetime.now(UTC)
        await self.session.execute(
            update(Message)
            .where(Message.conversation_id == conversation.id, Message.deleted_at.is_(None))
            .values(deleted_at=conversation.deleted_at)
        )

    async def list_messages(self, conversation_id: UUID) -> list[Message]:
        return list(
            await self.session.scalars(
                select(Message)
                .where(Message.conversation_id == conversation_id, Message.deleted_at.is_(None))
                .order_by(Message.sequence_no)
            )
        )
