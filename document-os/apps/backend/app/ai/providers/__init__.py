"""Provider registry: detection, caching, and access.

AI_PROVIDER=auto probes Ollama and falls back to the offline mock provider,
so the application always boots and every AI flow degrades gracefully.
"""
import logging

from app.ai.providers.base import LLMProvider
from app.ai.providers.mock import MockProvider
from app.ai.providers.ollama import OllamaProvider
from app.ai.providers.openai_compat import OpenAICompatProvider
from app.core.config import get_settings

logger = logging.getLogger("documentos.ai.providers")

_provider: LLMProvider | None = None


async def aget_provider() -> LLMProvider:
    """Resolve (once) and return the active provider.

    Priority under `auto`: Google AI (Gemma 4, needs GEMINI_API_KEY) →
    Ollama (local Gemma) → mock (offline demo).
    """
    global _provider
    if _provider is not None:
        return _provider

    settings = get_settings()
    mode = settings.AI_PROVIDER.lower()
    if mode == "mock":
        _provider = MockProvider()
    elif mode == "openai":
        _provider = OpenAICompatProvider()
    elif mode == "ollama":
        _provider = OllamaProvider()
    elif mode == "google":
        from app.ai.providers.google_ai import GoogleAIProvider

        _provider = GoogleAIProvider()
    else:  # auto
        if settings.GEMINI_API_KEY:
            from app.ai.providers.google_ai import GoogleAIProvider

            _provider = GoogleAIProvider()
            logger.info("AI provider: Google AI serving %s", settings.GOOGLE_MODEL)
        else:
            ollama = OllamaProvider()
            if await ollama.is_available():
                _provider = ollama
                logger.info("AI provider: Ollama serving %s", ollama.model)
            else:
                _provider = MockProvider()
                logger.warning(
                    "No Gemma runtime found (set GEMINI_API_KEY or run `ollama serve` "
                    "&& `ollama pull %s`) — using offline demo provider.",
                    settings.GEMMA_MODEL,
                )
    return _provider


def current_provider_name() -> str:
    """Name of the resolved provider (or 'unresolved' before the first call)."""
    return _provider.name if _provider is not None else "unresolved"


def reset_provider() -> None:
    """Drop the cached provider (used by tests)."""
    global _provider
    _provider = None


__all__ = [
    "LLMProvider",
    "MockProvider",
    "OllamaProvider",
    "OpenAICompatProvider",
    "GoogleAIProvider",
    "aget_provider",
    "current_provider_name",
    "reset_provider",
]


def __getattr__(name: str):  # lazy optional import
    if name == "GoogleAIProvider":
        from app.ai.providers.google_ai import GoogleAIProvider

        return GoogleAIProvider
    raise AttributeError(name)
