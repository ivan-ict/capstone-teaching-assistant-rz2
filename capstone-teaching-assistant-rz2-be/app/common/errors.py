import logging
from collections.abc import Sequence
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

logger = logging.getLogger(__name__)


class ErrorDetailDTO(BaseModel):
    field: str
    message: str


class ErrorDTO(BaseModel):
    code: str
    message: str
    details: list[ErrorDetailDTO] | None = None


class ErrorResponseDTO(BaseModel):
    error: ErrorDTO


class ApiError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        http_status: int = status.HTTP_400_BAD_REQUEST,
        details: Sequence[ErrorDetailDTO] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.http_status = http_status
        self.details = list(details or [])


class NotFoundError(ApiError):
    def __init__(self, message: str) -> None:
        super().__init__("RESOURCE_NOT_FOUND", message, status.HTTP_404_NOT_FOUND)


def _error_payload(error: ApiError) -> dict[str, Any]:
    error_payload: dict[str, Any] = {
        "code": error.code,
        "message": error.message,
    }
    if error.details:
        error_payload["details"] = [detail.model_dump() for detail in error.details]
    return {"error": error_payload}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.http_status, content=_error_payload(exc))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            ErrorDetailDTO(field=".".join(str(part) for part in error["loc"]), message=error["msg"])
            for error in exc.errors()
        ]
        api_error = ApiError(
            "VALIDATION_ERROR",
            "Request validation failed.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            details,
        )
        return JSONResponse(status_code=api_error.http_status, content=_error_payload(api_error))

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        api_error = _http_exception_error(exc)
        return JSONResponse(
            status_code=api_error.http_status,
            content=_error_payload(api_error),
            headers=exc.headers,
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_error_handler(_request: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.exception("Database error while handling API request.", exc_info=exc)
        api_error = ApiError(
            "DATABASE_ERROR",
            "Database operation failed.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        return JSONResponse(status_code=api_error.http_status, content=_error_payload(api_error))

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error while handling API request.", exc_info=exc)
        api_error = ApiError(
            "INTERNAL_SERVER_ERROR",
            "Internal server error.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        return JSONResponse(status_code=api_error.http_status, content=_error_payload(api_error))


def _http_exception_error(exc: HTTPException) -> ApiError:
    message = exc.detail if isinstance(exc.detail, str) else "HTTP request failed."
    if exc.status_code == status.HTTP_404_NOT_FOUND:
        return ApiError("RESOURCE_NOT_FOUND", message, exc.status_code)
    if exc.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
        return ApiError("METHOD_NOT_ALLOWED", message, exc.status_code)
    return ApiError("HTTP_ERROR", message, exc.status_code)
