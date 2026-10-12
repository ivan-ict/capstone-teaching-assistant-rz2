from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import (
    Conversation,
)
from tests.conftest import DEV_SEMESTER_ID, OTHER_SUPERVISOR_ID


@pytest.mark.asyncio
async def test_conversation_ownership_returns_not_found(
    client: AsyncClient, session: AsyncSession
) -> None:
    conversation = Conversation(
        semester_id=DEV_SEMESTER_ID, supervisor_id=OTHER_SUPERVISOR_ID, title="Other"
    )
    session.add(conversation)
    await session.commit()

    response = await client.get(f"/api/v1/conversations/{conversation.id}")

    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Conversation not found."


@pytest.mark.asyncio
async def test_framework_errors_use_api_error_shape(client: AsyncClient) -> None:
    missing_response = await client.get("/api/v1/not-a-real-route")
    method_response = await client.put("/api/v1/faculties")

    assert missing_response.status_code == 404
    assert missing_response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert method_response.status_code == 405
    assert method_response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_missing_conversation_delete_returns_not_found(client: AsyncClient) -> None:
    response = await client.delete(f"/api/v1/conversations/{uuid4()}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


pytestmark = pytest.mark.usefixtures("assigned_profiles")


async def test_current_semester_conversation_rename_search_and_soft_delete(client, session):
    from uuid import UUID

    from sqlalchemy import select

    from app.common.db_models import Message, MessageRole, MessageStatus

    created = (await client.post("/api/v1/conversations", json={})).json()
    conversation_id = created["id"]
    assert created["semester_id"] == str(DEV_SEMESTER_ID)
    renamed = await client.patch(
        f"/api/v1/conversations/{conversation_id}", json={"title": "Assessment guidance"}
    )
    assert renamed.status_code == 200
    session.add(
        Message(
            conversation_id=UUID(conversation_id),
            role=MessageRole.USER,
            status=MessageStatus.COMPLETED,
            sequence_no=1,
            content="A unique searchable question",
        )
    )
    await session.commit()
    results = await client.get(
        "/api/v1/conversations/search", params={"query": "unique searchable"}
    )
    assert [c["id"] for c in results.json()["items"]] == [conversation_id]
    assert (await client.delete(f"/api/v1/conversations/{conversation_id}")).status_code == 204
    assert (
        await client.get(f"/api/v1/conversations/{conversation_id}/messages")
    ).status_code == 404
    messages = list(
        await session.scalars(
            select(Message).where(Message.conversation_id == UUID(conversation_id))
        )
    )
    assert messages and all(message.deleted_at is not None for message in messages)
