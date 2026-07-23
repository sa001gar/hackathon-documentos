"""The Gemma Engine: single entry point for all LLM calls.

Responsibilities:
- Resolve the active provider (auto -> ollama if healthy else mock).
- Retries with backoff.
- Mock-provider safety net so a live demo can never hard-fail.
- Traceability: every call is reported through a log callback (persisted to ai_logs).

API endpoints NEVER call providers directly; they go through agents, which go
through this engine.
"""
import asyncio
import logging
import time
from typing import Awaitable, Callable, Optional

from app.ai.providers import BaseProvider, MockProvider, OllamaProvider, OpenAIProvider
from app.ai.schemas import LLMResponse
from app.core.config import get_settings

logger = logging.getLogger("documentos.ai")

LogCallback = Callable[[dict], None]


class GemmaEngine:
    def __init__(self, log_callback: Optional[LogCallback] = None) -> None:
        self._settings = get_settings()
        self._log_callback = log_callback
        self._provider: BaseProvider | None = None
        self._mock = MockProvider()
        self._lock = asyncio.Lock()

    async def _resolve_provider(self) -> BaseProvider:
        async with self._lock:
            if self._provider is not None:
                return self._provider
            mode = self._settings.AI_PROVIDER.lower()
            if mode == "mock":
                self._provider = self._mock
            elif mode == "openai":
                self._provider = OpenAIProvider()
            elif mode == "ollama":
                self._provider = OllamaProvider()
            else:  # auto
                ollama = OllamaProvider()
                if await ollama.health():
                    self._provider = ollama
                    logger.info("AI provider: Ollama (%s)", ollama.model)
                else:
                    self._provider = self._mock
                    logger.warning(
                        "Ollama not reachable at %s — using mock provider (offline demo mode).",
                        ollama.base_url,
                    )
            return self._provider

    @property
    def active_provider_name(self) -> str:
        return self._provider.name if self._provider else "unresolved"

    async def generate(
        self,
        *,
        agent: str,
        system: str,
        prompt: str,
        temperature: float = 0.4,
        document_id: str | None = None,
        section_id: str | None = None,
    ) -> LLMResponse:
        provider = await self._resolve_provider()
        max_attempts = self._settings.AI_MAX_RETRIES + 1
        last_error: Exception | None = None
        started = time.perf_counter()

        for attempt in range(max_attempts):
            try:
                response = await provider.generate(system, prompt, temperature)
                response.latency_ms = int((time.perf_counter() - started) * 1000)
                self._log(agent, response, system, prompt, "ok", "", document_id, section_id)
                return response
            except Exception as exc:  # noqa: BLE001 — any provider failure is recoverable here
                last_error = exc
                logger.warning("Provider %s attempt %d failed: %s", provider.name, attempt + 1, exc)
                await asyncio.sleep(min(2**attempt, 4))

        # Safety net: deterministic mock keeps the demo alive.
        logger.error("Provider %s exhausted retries (%s). Falling back to mock.", provider.name, last_error)
        response = await self._mock.generate(system, prompt, temperature)
        response.latency_ms = int((time.perf_counter() - started) * 1000)
        self._log(
            agent, response, system, prompt, "ok",
            f"primary provider failed: {last_error}", document_id, section_id,
        )
        return response

    def _log(
        self, agent: str, response: LLMResponse, system: str, prompt: str,
        status: str, error: str, document_id: str | None, section_id: str | None,
    ) -> None:
        if not self._log_callback:
            return
        try:
            self._log_callback({
                "agent": agent,
                "model": response.model,
                "provider": response.provider,
                "prompt": f"[SYSTEM]\n{system}\n\n[USER]\n{prompt}"[:8000],
                "response": response.text[:8000],
                "latency_ms": response.latency_ms,
                "status": status,
                "error": error[:2000],
                "document_id": document_id,
                "section_id": section_id,
            })
        except Exception:  # noqa: BLE001 — logging must never break generation
            logger.exception("Failed to record AI log")


# Module-level singleton; log callback is (re)bound per request by services.
_engine: GemmaEngine | None = None


def get_engine(log_callback: Optional[LogCallback] = None) -> GemmaEngine:
    global _engine
    if _engine is None:
        _engine = GemmaEngine(log_callback=log_callback)
    elif log_callback is not None:
        _engine._log_callback = log_callback
    return _engine


def run_sync(coro: Awaitable):
    """Run an async coroutine from sync service code (background threads included)."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    # Inside a running loop (uvicorn request thread): schedule and block via a new loop
    # in a separate thread to avoid nested-loop errors.
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(lambda: asyncio.run(coro)).result()
