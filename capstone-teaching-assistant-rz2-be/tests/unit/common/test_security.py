from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.common.config import DEFAULT_JWT_SECRET_KEY, Settings
from app.common.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_and_verify() -> None:
    hashed = hash_password("Password123!")

    assert verify_password("Password123!", hashed)
    assert not verify_password("wrong", hashed)


def test_invalid_password_hash_returns_false() -> None:
    assert not verify_password("Password123!", "not-a-valid-hash")


def test_access_token_round_trip() -> None:
    user_id = uuid4()

    token = create_access_token(user_id)

    assert decode_access_token(token) == user_id


def test_default_jwt_secret_is_rejected_outside_local_environments() -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_environment="production",
            jwt_secret_key=DEFAULT_JWT_SECRET_KEY,
        )


def test_unsupported_jwt_algorithm_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_ALGORITHM", "none")
    with pytest.raises(ValidationError):
        Settings()


@pytest.mark.parametrize(
    ("env_name", "env_value"),
    [
        ("EMBEDDING_DIMENSION", "0"),
        ("RAG_TOP_K", "0"),
        ("CHUNK_SIZE", "0"),
        ("CHUNK_OVERLAP", "-1"),
        ("MAX_UPLOAD_BYTES", "0"),
        ("ACCESS_TOKEN_EXPIRE_MINUTES", "0"),
        ("OLLAMA_CHAT_TEMPERATURE", "-0.1"),
        ("OLLAMA_CHAT_NUM_PREDICT", "0"),
        ("OLLAMA_CHAT_NUM_CTX", "0"),
        ("OLLAMA_CHAT_NUM_THREAD", "0"),
        ("OLLAMA_CHAT_NUM_GPU", "-1"),
    ],
)
def test_invalid_numeric_settings_are_rejected(
    monkeypatch: pytest.MonkeyPatch, env_name: str, env_value: str
) -> None:
    monkeypatch.setenv(env_name, env_value)
    with pytest.raises(ValidationError):
        Settings()


def test_ollama_generation_settings_load_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OLLAMA_CHAT_TEMPERATURE", "0.1")
    monkeypatch.setenv("OLLAMA_CHAT_NUM_PREDICT", "256")
    monkeypatch.setenv("OLLAMA_CHAT_NUM_CTX", "4096")
    monkeypatch.setenv("OLLAMA_CHAT_REASONING", "false")
    monkeypatch.setenv("OLLAMA_CHAT_KEEP_ALIVE", "10m")
    monkeypatch.setenv("OLLAMA_CHAT_NUM_THREAD", "8")
    monkeypatch.setenv("OLLAMA_CHAT_NUM_GPU", "1")

    settings = Settings()

    assert settings.ollama_chat_temperature == 0.1
    assert settings.ollama_chat_num_predict == 256
    assert settings.ollama_chat_num_ctx == 4096
    assert settings.ollama_chat_reasoning is False
    assert settings.ollama_chat_keep_alive == "10m"
    assert settings.ollama_chat_num_thread == 8
    assert settings.ollama_chat_num_gpu == 1


def test_optional_ollama_generation_settings_delegate_to_ollama_defaults(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for env_name in (
        "OLLAMA_CHAT_NUM_PREDICT",
        "OLLAMA_CHAT_NUM_CTX",
        "OLLAMA_CHAT_REASONING",
        "OLLAMA_CHAT_KEEP_ALIVE",
        "OLLAMA_CHAT_NUM_THREAD",
        "OLLAMA_CHAT_NUM_GPU",
    ):
        monkeypatch.delenv(env_name, raising=False)

    settings = Settings(_env_file=None)

    assert settings.ollama_chat_num_predict is None
    assert settings.ollama_chat_num_ctx is None
    assert settings.ollama_chat_reasoning is None
    assert settings.ollama_chat_keep_alive is None
    assert settings.ollama_chat_num_thread is None
    assert settings.ollama_chat_num_gpu is None


def test_invalid_chunk_overlap_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHUNK_SIZE", "100")
    monkeypatch.setenv("CHUNK_OVERLAP", "100")
    with pytest.raises(ValidationError):
        Settings()


def test_wildcard_cors_origin_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(cors_allowed_origins=["*"])
