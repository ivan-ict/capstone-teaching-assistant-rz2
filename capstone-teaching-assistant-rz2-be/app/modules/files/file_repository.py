from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import DocumentChunk, File, FileProcessingStatus, MessageFile


class FileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        file_id: UUID,
        supervisor_id: UUID,
        original_filename: str,
        stored_filename: str,
        storage_base_url: str,
        storage_path: str,
        mime_type: str,
        file_size_bytes: int,
    ) -> File:
        file = File(
            id=file_id,
            supervisor_id=supervisor_id,
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

    async def get_for_supervisor(self, file_id: UUID, supervisor_id: UUID) -> File | None:
        query = select(File).where(
            File.id == file_id,
            File.supervisor_id == supervisor_id,
            File.deleted_at.is_(None),
        )
        return await self.session.scalar(query)

    async def list_for_supervisor(
        self,
        supervisor_id: UUID,
        search: str | None,
        processing_status: FileProcessingStatus | None,
        page: int,
        page_size: int,
    ) -> tuple[list[File], int]:
        filters = [File.supervisor_id == supervisor_id, File.deleted_at.is_(None)]
        if search:
            filters.append(File.original_filename.ilike(f"%{search}%"))
        if processing_status:
            filters.append(File.processing_status == processing_status)

        total_query = select(func.count()).select_from(File).where(*filters)
        total = await self.session.scalar(total_query) or 0
        items_query = (
            select(File)
            .where(*filters)
            .order_by(File.created_at.desc())
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
        deleted_at = datetime.now(UTC)
        file.deleted_at = deleted_at
        await self.session.execute(
            update(DocumentChunk)
            .where(
                DocumentChunk.file_id == file.id,
                DocumentChunk.deleted_at.is_(None),
            )
            .values(deleted_at=deleted_at)
        )
        await self.session.execute(
            update(MessageFile)
            .where(
                MessageFile.file_id == file.id,
                MessageFile.deleted_at.is_(None),
            )
            .values(deleted_at=deleted_at)
        )
        await self.session.flush()
