from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
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
    ollama_vision_model: str = "qwen3-vl:2b"
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
    email_backend: Literal["smtp", "console"] = "console"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = Field(default=587, gt=0)
    smtp_username: str = ""
    smtp_password: str = Field(default="", repr=False)
    smtp_from_email: str = ""
    smtp_from_name: str = "Capstone Teaching Assistant"
    smtp_timeout_seconds: float = Field(default=15, gt=0)
    frontend_login_url: str = "http://localhost:3000"
    password_reset_cooldown_seconds: int = Field(default=300, ge=0)
    password_reset_ip_limit: int = Field(default=10, gt=0)
    password_reset_ip_window_seconds: int = Field(default=600, gt=0)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("smtp_password")
    @classmethod
    def strip_app_password_spaces(cls, value: str) -> str:
        # Google displays app passwords in groups of four separated by spaces.
        return "".join(value.split())

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
        if self.email_backend == "smtp" and not (self.smtp_username and self.smtp_password):
            msg = "SMTP_USERNAME and SMTP_PASSWORD are required when EMAIL_BACKEND=smtp."
            raise ValueError(msg)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
