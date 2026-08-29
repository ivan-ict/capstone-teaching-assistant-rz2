from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET_KEY = "local-dev-change-me-with-at-least-32-bytes"
LOCAL_ENVIRONMENTS = {"development", "local", "test"}


class Settings(BaseSettings):
    app_environment: str = "development"
    database_url: str = "postgresql+psycopg://capstone:capstone@localhost:5432/capstone"
    rustfs_endpoint_url: str = "http://localhost:9000"
    rustfs_access_key: str = "capstone"
    rustfs_secret_key: str = Field(default="capstone-secret", repr=False)
    rustfs_bucket_name: str = "capstone-files"
    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "qwen3"
    # ollama_chat_model: str = "qwen3-vl:2b"
    ollama_chat_temperature: float = Field(default=0.2, ge=0)
    ollama_chat_num_predict: int | None = Field(default=None, gt=0)
    ollama_chat_num_ctx: int | None = Field(default=None, gt=0)
    ollama_chat_reasoning: bool | None = None
    ollama_chat_keep_alive: int | str | None = None
    ollama_chat_num_thread: int | None = Field(default=None, gt=0)
    ollama_chat_num_gpu: int | None = Field(default=None, ge=0)
    ollama_embedding_model: str = "qwen3-embedding:0.6b"
    embedding_dimension: int = Field(default=1024, gt=0)
    rag_top_k: int = Field(default=5, gt=0)
    chunk_size: int = Field(default=1200, gt=0)
    chunk_overlap: int = Field(default=200, ge=0)
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, gt=0)
    jwt_secret_key: str = DEFAULT_JWT_SECRET_KEY
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = Field(default=1440, gt=0)
    cors_allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:8501",
    ]
    local_admin_username: str = "admin"
    local_admin_password: str = Field(default="AdminPassword123!", repr=False)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_security_settings(self) -> Settings:
        if (
            self.app_environment.lower() not in LOCAL_ENVIRONMENTS
            and self.jwt_secret_key == DEFAULT_JWT_SECRET_KEY
        ):
            msg = "JWT_SECRET_KEY must be changed outside local development."
            raise ValueError(msg)
        if len(self.jwt_secret_key) < 32:
            msg = "JWT_SECRET_KEY must be at least 32 characters."
            raise ValueError(msg)
        if self.chunk_overlap >= self.chunk_size:
            msg = "CHUNK_OVERLAP must be smaller than CHUNK_SIZE."
            raise ValueError(msg)
        if "*" in self.cors_allowed_origins:
            msg = "CORS_ALLOWED_ORIGINS must list explicit origins because credentials are enabled."
            raise ValueError(msg)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
