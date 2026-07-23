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
    """Resolve (once) and return the active provider."""
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
    else:  # auto
        ollama = OllamaProvider()
        if await ollama.is_available():
            _provider = ollama
            logger.info("AI provider: Ollama serving %s", ollama.model)
        else:
            _provider = MockProvider()
            logger.warning(
                "Gemma unreachable at %s — using offline demo provider. "
                "Run `ollama serve` and `ollama pull %s` for real generation.",
                settings.OLLAMA_BASE_URL,
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
    "aget_provider",
    "current_provider_name",
    "reset_provider",
]
