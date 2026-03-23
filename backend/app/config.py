from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    app_name: str = "RAG Backend"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    frontend_origin: str = "http://localhost:5173"
    database_url: str = "sqlite:///./rag_app.db"
    upload_dir: str = "./data/uploads"
    default_admin_username: str = "admin"
    default_admin_password: str = "change-me"
    dashscope_api_key: Optional[str] = None
    dashscope_model: str = "qwen-max"
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    dashscope_multimodal_model: str = "qwen3.5-plus"
    dashscope_audio_model: str = "qwen3-omni-flash"
    dashscope_embedding_model: str = "text-embedding-v4"
    dashscope_embedding_dimensions: int = 1024
    dashscope_embedding_url: str = "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


def _resolve_sqlite_url(raw_url: str) -> str:
    prefix = "sqlite:///"
    if not raw_url.startswith(prefix):
        return raw_url

    target = raw_url[len(prefix) :]
    if not target or target == ":memory:":
        return raw_url

    path = Path(target)
    if not path.is_absolute():
        path = (BASE_DIR / path).resolve()
    return f"{prefix}{path}"


def _resolve_dir(raw_path: str) -> str:
    path = Path(raw_path)
    if path.is_absolute():
        return str(path)
    return str((BASE_DIR / path).resolve())


settings = Settings()
settings.database_url = _resolve_sqlite_url(settings.database_url)
settings.upload_dir = _resolve_dir(settings.upload_dir)
