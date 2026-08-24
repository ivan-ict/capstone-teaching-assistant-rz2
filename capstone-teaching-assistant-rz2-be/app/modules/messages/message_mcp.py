from dataclasses import dataclass
from uuid import UUID

from app.modules.messages.message_model import RetrievedChunkDTO


@dataclass(frozen=True)
class McpToolDescriptor:
    name: str
    description: str


class MessageMcpToolRegistry:
    """Boundary for future MCP tool exposure around chat retrieval."""

    def descriptors(self) -> list[McpToolDescriptor]:
        return [
            McpToolDescriptor(
                name="retrieve_conversation_chunks",
                description="Retrieve supervisor-owned document chunks for a chat question.",
            )
        ]

    def format_retrieved_chunks(self, chunks: list[RetrievedChunkDTO]) -> str:
        if not chunks:
            return "No document context was retrieved."
        formatted_chunks = []
        for index, chunk in enumerate(chunks, start=1):
            formatted_chunks.append(
                "\n".join(
                    [
                        f"[Context {index}]",
                        f"file_id: {chunk.file_id}",
                        f"filename: {chunk.original_filename}",
                        chunk.content,
                    ]
                )
            )
        return "\n\n".join(formatted_chunks)

    def retrieval_scope(self, conversation_id: UUID, file_ids: list[UUID]) -> dict[str, object]:
        return {
            "conversation_id": str(conversation_id),
            "file_ids": [str(file_id) for file_id in file_ids],
        }
