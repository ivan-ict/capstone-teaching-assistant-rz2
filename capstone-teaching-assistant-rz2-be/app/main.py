import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.common.ai import preload_ollama_models
from app.common.config import get_settings
from app.common.errors import (
    ErrorDetailDTO,
    ErrorDTO,
    ErrorResponseDTO,
    register_exception_handlers,
)
from app.modules.account.account_router import account_router
from app.modules.admin.supervisors.supervisor_router import supervisor_router
from app.modules.auth.auth_router import auth_router
from app.modules.conversations.conversation_router import conversation_router
from app.modules.faculties.faculty_router import admin_faculty_router, faculty_router
from app.modules.files.file_router import file_router
from app.modules.messages.message_router import message_router
from app.modules.semesters.semester_router import semester_router

ROLE_PROTECTED_TAGS = {
    "Admin Supervisors",
    "Admin Faculties",
    "Conversations",
    "Files",
    "Messages",
    "Admin Semesters",
}


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    task = (
        asyncio.create_task(preload_ollama_models(settings))
        if settings.ollama_preload_models
        else None
    )
    yield
    if task and not task.done():
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        lifespan=lifespan,
        title="Capstone Teaching Assistant API",
        version="0.1.0",
        description="Backend API for the Capstone Teaching Assistant project.",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(account_router, prefix="/api/v1")
    app.include_router(faculty_router, prefix="/api/v1")
    app.include_router(admin_faculty_router, prefix="/api/v1")
    app.include_router(supervisor_router, prefix="/api/v1")
    app.include_router(semester_router, prefix="/api/v1")
    app.include_router(conversation_router, prefix="/api/v1")
    app.include_router(file_router, prefix="/api/v1")
    app.include_router(message_router, prefix="/api/v1")
    _install_custom_openapi(app)
    return app


def _install_custom_openapi(app: FastAPI) -> None:
    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        _install_error_schemas(openapi_schema)
        _replace_validation_error_responses(openapi_schema)
        _install_auth_error_responses(openapi_schema)
        app.openapi_schema = openapi_schema
        return app.openapi_schema

    object.__setattr__(app, "openapi", custom_openapi)


def _install_error_schemas(openapi_schema: dict[str, Any]) -> None:
    components = openapi_schema.setdefault("components", {}).setdefault("schemas", {})
    for model in (ErrorDetailDTO, ErrorDTO, ErrorResponseDTO):
        schema = model.model_json_schema(ref_template="#/components/schemas/{model}")
        schema.pop("$defs", None)
        components[model.__name__] = schema
    components.pop("HTTPValidationError", None)
    components.pop("ValidationError", None)


def _replace_validation_error_responses(openapi_schema: dict[str, Any]) -> None:
    validation_response = {
        "description": "Validation Error",
        "content": {
            "application/json": {
                "schema": {"$ref": "#/components/schemas/ErrorResponseDTO"},
            }
        },
    }
    for path_item in openapi_schema.get("paths", {}).values():
        for operation in path_item.values():
            if (
                isinstance(operation, dict)
                and "responses" in operation
                and "422" in operation["responses"]
            ):
                operation["responses"]["422"] = validation_response


def _install_auth_error_responses(openapi_schema: dict[str, Any]) -> None:
    unauthorized_response = _error_response("Authentication Error")
    forbidden_response = _error_response("Forbidden")
    for path_item in openapi_schema.get("paths", {}).values():
        for operation in path_item.values():
            if not isinstance(operation, dict) or not operation.get("security"):
                continue
            responses = operation.setdefault("responses", {})
            responses.setdefault("401", unauthorized_response)
            if set(operation.get("tags", [])) & ROLE_PROTECTED_TAGS:
                responses.setdefault("403", forbidden_response)


def _error_response(description: str) -> dict[str, Any]:
    return {
        "description": description,
        "content": {
            "application/json": {
                "schema": {"$ref": "#/components/schemas/ErrorResponseDTO"},
            }
        },
    }


app = create_app()
