from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import Project
from app.common.errors import NotFoundError
from app.modules.conversations.conversation_service import ConversationService
from tests.conftest import DEV_SUPERVISOR_ID, OTHER_SUPERVISOR_ID


@pytest.mark.asyncio
async def test_create_conversation_for_owned_project(session: AsyncSession) -> None:
    project = Project(supervisor_id=DEV_SUPERVISOR_ID, name="Team Alpha")
    session.add(project)
    await session.commit()

    result = await ConversationService(session).create_conversation(
        supervisor_id=DEV_SUPERVISOR_ID,
        project_id=project.id,
    )

    assert result.project_id == project.id
    assert result.title == "New conversation"


@pytest.mark.asyncio
async def test_create_conversation_rejects_project_owned_by_other_supervisor(
    session: AsyncSession,
) -> None:
    project = Project(supervisor_id=OTHER_SUPERVISOR_ID, name="Other Team")
    session.add(project)
    await session.commit()

    with pytest.raises(NotFoundError):
        await ConversationService(session).create_conversation(
            supervisor_id=DEV_SUPERVISOR_ID,
            project_id=project.id,
        )


@pytest.mark.asyncio
async def test_list_unprojected_conversations(session: AsyncSession) -> None:
    service = ConversationService(session)
    projected = Project(supervisor_id=DEV_SUPERVISOR_ID, name="Team Alpha")
    session.add(projected)
    await session.commit()
    await service.create_conversation(DEV_SUPERVISOR_ID, None)
    await service.create_conversation(DEV_SUPERVISOR_ID, projected.id)

    result = await service.list_conversations(
        supervisor_id=DEV_SUPERVISOR_ID,
        project_id=None,
        unprojected=True,
    )

    assert len(result.items) == 1
    assert result.items[0].project_id is None


@pytest.mark.asyncio
async def test_rename_missing_conversation_raises_not_found(session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await ConversationService(session).rename_conversation(
            supervisor_id=DEV_SUPERVISOR_ID,
            conversation_id=uuid4(),
            title="New title",
        )
