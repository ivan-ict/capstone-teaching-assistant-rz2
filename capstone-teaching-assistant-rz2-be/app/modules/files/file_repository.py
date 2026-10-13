from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import (
    Conversation,
    DocumentChunk,
    File,
    FileProcessingStatus,
    Message,
    SupervisorProfile,
    UserRole,
)
from app.common.sorting import sort_clauses


class FileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        file_id: UUID,
        semester_id: UUID,
        uploaded_by: UUID,
        original_filename: str,
        stored_filename: str,
        storage_base_url: str,
        storage_path: str,
        mime_type: str,
        file_size_bytes: int,
    ) -> File:
        file = File(
            id=file_id,
            semester_id=semester_id,
            uploaded_by=uploaded_by,
            original_filename=original_filename,
            stored_filename=stored_filename,
            storage_base_url=storage_base_url,
            storage_path=storage_path,
            mime_type=mime_type,
            file_size_bytes=file_size_bytes,
            processing_status=FileProcessingStatus.PROCESSING,
        )
        self.session.add(file)
        await self.session.flush()
        await self.session.refresh(file)
        return file

    async def get_for_semester(self, file_id: UUID, semester_id: UUID) -> File | None:
        query = select(File).where(
            File.id == file_id,
            File.semester_id == semester_id,
            File.deleted_at.is_(None),
        )
        return await self.session.scalar(query)

    async def list_for_semester(
        self,
        semester_id: UUID,
        search: str | None,
        processing_status: FileProcessingStatus | None,
        page: int,
        page_size: int,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> tuple[list[File], int]:
        filters = [File.semester_id == semester_id, File.deleted_at.is_(None)]
        if search:
            filters.append(File.original_filename.ilike(f"%{search}%"))
        if processing_status:
            filters.append(File.processing_status == processing_status)

        total_query = select(func.count()).select_from(File).where(*filters)
        total = await self.session.scalar(total_query) or 0
        items_query = (
            select(File)
            .where(*filters)
            .order_by(
                *sort_clauses(
                    {
                        "name": File.original_filename,
                        "type": File.mime_type,
                        "size": File.file_size_bytes,
                        "status": File.processing_status,
                        "created_at": File.created_at,
                    }[sort_by],
                    sort_order,
                    File.id,
                )
            )
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(await self.session.scalars(items_query))
        return items, total

    async def add_chunks(
        self, file_id: UUID, chunks: list[str], embeddings: list[list[float]]
    ) -> None:
        for index, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
            self.session.add(
                DocumentChunk(
                    file_id=file_id,
                    chunk_index=index,
                    content=chunk,
                    page_number=None,
                    embedding=embedding,
                )
            )
        await self.session.flush()

    async def set_processing_result(
        self,
        file: File,
        status: FileProcessingStatus,
        processing_error: str | None = None,
    ) -> File:
        file.processing_status = status
        file.processing_error = processing_error
        await self.session.flush()
        await self.session.refresh(file)
        return file

    async def delete(self, file: File) -> None:
        file.deleted_at = datetime.now(UTC)
        await self.session.flush()

    async def accessible_file(self, file_id: UUID, user_id: UUID, role: UserRole) -> File | None:
        file = await self.session.scalar(
            select(File).where(File.id == file_id, File.deleted_at.is_(None))
        )
        if file is None or role == UserRole.ADMIN:
            return file
        sources = await self.session.scalars(
            select(Message.sources)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(SupervisorProfile, SupervisorProfile.user_id == Conversation.supervisor_id)
            .where(
                Conversation.supervisor_id == user_id,
                Conversation.semester_id == file.semester_id,
                SupervisorProfile.semester_id == file.semester_id,
                SupervisorProfile.deleted_at.is_(None),
                Conversation.deleted_at.is_(None),
                Message.deleted_at.is_(None),
            )
        )
        if any(str(source.get("file_id")) == str(file_id) for items in sources for source in items):
            return file
        return None
