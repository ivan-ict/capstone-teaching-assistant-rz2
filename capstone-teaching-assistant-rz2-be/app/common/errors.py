from collections.abc import Sequence
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorDetailDTO(BaseModel):
    field: str
    message: str


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
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            details,
        )
        return JSONResponse(status_code=api_error.http_status, content=_error_payload(api_error))
