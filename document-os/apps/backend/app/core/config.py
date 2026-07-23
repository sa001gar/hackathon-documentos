"""Application configuration (12-factor, env-driven)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database (SQLite default locally; set external Postgres URL in deployment)
    DATABASE_URL: str = "sqlite:///./documentos.db"
    # Reserved — job runner is in-process; used when a Redis queue backend lands
    REDIS_URL: str = ""

    # Auth
    JWT_SECRET: str = "change-me-in-production-0123456789abcdef"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI engine
    AI_PROVIDER: str = "auto"  # auto | google | ollama | openai | mock
    # Google AI SDK (Gemma 4 hosted) — https://aistudio.google.com/apikey
    GEMINI_API_KEY: str = ""
    GOOGLE_MODEL: str = "gemma-4-26b-a4b-it"
    # Ollama (Gemma running locally)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    GEMMA_MODEL: str = "gemma3"
    # Any OpenAI-compatible server (vLLM, llama.cpp, LM Studio)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    AI_REQUEST_TIMEOUT: int = 180
    AI_MAX_RETRIES: int = 2
    PROMPTS_DIR: str = "../../packages/prompts"

    # App
    CORS_ORIGINS: str = "http://localhost:5173"
    EXPORT_DIR: str = "./exports"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
