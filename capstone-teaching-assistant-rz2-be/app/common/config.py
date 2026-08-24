from functools import lru_cache
from uuid import UUID

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_environment: str = "development"
    database_url: str = "postgresql+psycopg://capstone:capstone@localhost:5432/capstone"
    dev_supervisor_id: UUID = UUID("11111111-1111-1111-1111-111111111111")
    rustfs_endpoint_url: str = "http://localhost:9000"
    rustfs_access_key: str = "capstone"
    rustfs_secret_key: str = Field(default="capstone-secret", repr=False)
    rustfs_bucket_name: str = "capstone-files"
    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "qwen3"
    ollama_embedding_model: str = "qwen3-embedding:0.6b"
    rag_top_k: int = 5
    chunk_size: int = 1200
    chunk_overlap: int = 200

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
