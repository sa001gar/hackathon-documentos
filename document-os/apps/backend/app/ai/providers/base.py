"""Provider protocol — the only interface the AI layer talks to."""
from typing import AsyncIterator, Protocol, runtime_checkable

from app.ai.schemas import LLMMessage, LLMResponse


@runtime_checkable
class LLMProvider(Protocol):
    """A chat-completion backend (Ollama, OpenAI-compatible, mock…)."""

    name: str

    async def complete(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float,
        max_tokens: int,
    ) -> LLMResponse:
        """Return the full assistant reply."""
        ...

    async def stream(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float,
        max_tokens: int,
    ) -> AsyncIterator[str]:
        """Yield the assistant reply token-by-token."""
        ...
