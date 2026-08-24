from fastapi import FastAPI

from app.common.errors import register_exception_handlers
from app.modules.conversations.conversation_router import conversation_router
from app.modules.files.file_router import file_router
from app.modules.messages.message_router import message_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="Capstone Teaching Assistant API",
        version="0.1.0",
        description="Backend API for the Capstone Teaching Assistant project.",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    register_exception_handlers(app)
    app.include_router(conversation_router, prefix="/api/v1")
    app.include_router(file_router, prefix="/api/v1")
    app.include_router(message_router, prefix="/api/v1")
    return app


app = create_app()
