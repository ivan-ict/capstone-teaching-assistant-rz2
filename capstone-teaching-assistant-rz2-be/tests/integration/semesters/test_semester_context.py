"""Documents are shared by semester; conversational knowledge stays private."""

from datetime import UTC, date, datetime
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.common.auth import CurrentUser, get_current_user
from app.common.db_models import (
    AccountStatus,
    Conversation,
    DocumentChunk,
    File,
    FileProcessingStatus,
    Message,
    MessageRole,
    MessageStatus,
    Semester,
    SupervisorProfile,
    UserRole,
)
from app.common.errors import ApiError
from app.main import app
from app.modules.files.file_service import FileService
from app.modules.messages.message_service import MessageService
from app.modules.semesters.semester_service import SemesterService
from tests.conftest import DEV_SEMESTER_ID, DEV_SUPERVISOR_ID, OTHER_SUPERVISOR_ID
from tests.unit.files.test_file_service import FakeStorage
from tests.unit.messages.test_message_service import FakeChat, FakeEmbeddings

pytestmark = pytest.mark.usefixtures("assigned_profiles")


async def knowledge(
    session, semester_id, name="Shared handbook", status=FileProcessingStatus.READY
):
    file = File(
        semester_id=semester_id,
        uploaded_by=OTHER_SUPERVISOR_ID,
        original_filename=name,
        stored_filename=name,
        storage_base_url="http://storage/",
        storage_path=name,
        mime_type="text/plain",
        file_size_bytes=10,
        processing_status=status,
    )
    session.add(file)
    await session.flush()
    chunk = DocumentChunk(file_id=file.id, chunk_index=0, content=name, embedding=[0.1] * 1024)
    session.add(chunk)
    await session.commit()
    return file, chunk


async def conversation(session, supervisor_id=DEV_SUPERVISOR_ID, semester_id=DEV_SEMESTER_ID):
    item = Conversation(supervisor_id=supervisor_id, semester_id=semester_id, title="History")
    session.add(item)
    await session.flush()
    return item


async def prior_message(session, conversation, content):
    message = Message(
        conversation_id=conversation.id,
        sequence_no=1,
        role=MessageRole.USER,
        status=MessageStatus.COMPLETED,
        content=content,
        embedding=[0.1] * 1024,
    )
    session.add(message)
    await session.commit()
    return message


async def test_answers_use_shared_documents_and_only_personal_same_semester_memory(session):
    other = Semester(
        name="Other semester", year=2026, start_date=date(2026, 7, 1), end_date=date(2026, 12, 31)
    )
    session.add(other)
    await session.flush()
    shared, _ = await knowledge(session, DEV_SEMESTER_ID)
    await knowledge(session, other.id, "FOREIGN DOCUMENT")
    current = await conversation(session)
    own = await conversation(session)
    peer = await conversation(session, OTHER_SUPERVISOR_ID)
    old = await conversation(session, semester_id=other.id)
    await prior_message(session, own, "PERSONAL FACT")
    await prior_message(session, peer, "PEER PRIVATE FACT")
    await prior_message(session, old, "OLD SEMESTER FACT")
    chat = FakeChat()
    service = MessageService(session, chat=chat, embeddings=FakeEmbeddings())
    pair = await service.create_message_pair(
        DEV_SUPERVISOR_ID, current.id, "What does the handbook say?"
    )
    context = await service.prepare_assistant_stream(DEV_SUPERVISOR_ID, pair.assistant_message.id)
    events = [event async for event in service.stream_assistant_response(context)]
    assert "event: complete" in events[-1]
    assert chat.system_prompt is not None
    assert "Shared handbook" in chat.system_prompt
    assert "PERSONAL FACT" in chat.system_prompt
    assert "PEER PRIVATE FACT" not in chat.system_prompt
    assert "OLD SEMESTER FACT" not in chat.system_prompt
    assert "FOREIGN DOCUMENT" not in chat.system_prompt
    saved = await session.get(Message, pair.assistant_message.id)
    assert saved.sources[0]["file_id"] == str(shared.id)


@pytest.mark.parametrize("excluded", ["deleted_file", "deleted_chunk", "failed", "processing"])
async def test_future_retrieval_excludes_unusable_documents(session, excluded):
    file, chunk = await knowledge(session, DEV_SEMESTER_ID, "MUST NOT APPEAR")
    if excluded == "deleted_file":
        file.deleted_at = datetime.now(UTC)
    elif excluded == "deleted_chunk":
        chunk.deleted_at = datetime.now(UTC)
    else:
        file.processing_status = (
            FileProcessingStatus.FAILED if excluded == "failed" else FileProcessingStatus.PROCESSING
        )
    current = await conversation(session)
    await session.commit()
    chat = FakeChat()
    service = MessageService(session, chat=chat, embeddings=FakeEmbeddings())
    pair = await service.create_message_pair(DEV_SUPERVISOR_ID, current.id, "Hello")
    context = await service.prepare_assistant_stream(DEV_SUPERVISOR_ID, pair.assistant_message.id)
    assert [event async for event in service.stream_assistant_response(context)]
    assert chat.system_prompt is not None
    assert "MUST NOT APPEAR" not in chat.system_prompt


async def test_only_cited_current_semester_files_can_be_downloaded_and_deletion_preserves_sources(
    session, client
):
    file, _ = await knowledge(session, DEV_SEMESTER_ID)
    current = await conversation(session)
    message = await prior_message(session, current, "Saved answer")
    user = CurrentUser(DEV_SUPERVISOR_ID, "supervisor", UserRole.SUPERVISOR, AccountStatus.ACTIVE)
    storage = FakeStorage()
    service = FileService(session, storage=storage)
    with pytest.raises(ApiError):
        await service.authorize_file(user, file.id)
    message.sources = [
        {
            "file_id": str(file.id),
            "original_filename": file.original_filename,
            "content": "Saved citation",
        }
    ]
    await session.commit()
    assert await service.authorize_file(user, file.id) == DEV_SEMESTER_ID
    # Archiving must not hide readable history or its files.
    await SemesterService(session).archive(DEV_SEMESTER_ID)
    assert await service.authorize_file(user, file.id) == DEV_SEMESTER_ID
    semester = await session.get(Semester, DEV_SEMESTER_ID)
    semester.deleted_at = None
    await session.commit()
    await service.delete_file(DEV_SEMESTER_ID, file.id)
    assert storage.deleted_paths == []
    with pytest.raises(ApiError):
        await service.authorize_file(user, file.id)
    history = await client.get(f"/api/v1/conversations/{current.id}/messages")
    assert history.json()["items"][0]["sources"][0]["content"] == "Saved citation"


@pytest.mark.parametrize("change", ["archive", "transfer"])
async def test_pending_stream_and_retry_cannot_bypass_assignment_or_archive(
    session, client, change
):
    current = await conversation(session)
    await session.commit()
    pair = await MessageService(session).create_message_pair(DEV_SUPERVISOR_ID, current.id, "Hello")
    if change == "archive":
        await SemesterService(session).archive(DEV_SEMESTER_ID)
    else:
        other = Semester(
            name="Other", year=2026, start_date=date(2026, 1, 1), end_date=date(2026, 2, 1)
        )
        session.add(other)
        await session.flush()
        profile = await session.scalar(
            select(SupervisorProfile).where(SupervisorProfile.user_id == DEV_SUPERVISOR_ID)
        )
        profile.semester_id = other.id
        await session.commit()
    expected = 409 if change == "archive" else 404
    assert (await client.get(pair.stream_url)).status_code == expected
    assert (
        await client.post(f"/api/v1/messages/{pair.assistant_message.id}/retry")
    ).status_code == expected


async def test_supervisor_cannot_manage_semesters_upload_or_assign(client):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        DEV_SUPERVISOR_ID, "supervisor", UserRole.SUPERVISOR, AccountStatus.ACTIVE
    )
    try:
        assert (await client.get("/api/v1/admin/semesters")).status_code == 403
        assert (
            await client.post(
                f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}/files",
                files={"file": ("notes.txt", b"notes", "text/plain")},
            )
        ).status_code == 403
        assert (
            await client.post(
                f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}/supervisors",
                json={"supervisor_ids": [str(OTHER_SUPERVISOR_ID)]},
            )
        ).status_code == 403
        assert (
            await client.delete(f"/api/v1/admin/semesters/{DEV_SEMESTER_ID}/files/{uuid4()}")
        ).status_code == 403
        assert (
            await client.post("/api/v1/conversations", json={"semester_id": str(uuid4())})
        ).status_code == 422
        current = (await client.post("/api/v1/conversations", json={})).json()
        assert (
            await client.post(
                f"/api/v1/conversations/{current['id']}/messages",
                json={"content": "Hi", "file_ids": []},
            )
        ).status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)
