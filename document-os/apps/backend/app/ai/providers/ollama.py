"""Ollama provider — local Gemma served by `ollama serve` (/api/chat)."""
import json
import time
from typing import AsyncIterator

import httpx

from app.ai.schemas import LLMMessage, LLMResponse
from app.core.config import get_settings
from app.core.errors import AIProviderError


class OllamaProvider:
    name = "ollama"

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model = settings.GEMMA_MODEL
        self.timeout = settings.AI_REQUEST_TIMEOUT

    # -- helpers ------------------------------------------------------------

    def _unreachable(self, exc: Exception) -> AIProviderError:
        return AIProviderError(
            f"Ollama unreachable at {self.base_url} — run `ollama serve` and "
            f"`ollama pull {self.model}` ({exc})"
        )

    def _payload(
        self, messages: list[LLMMessage], *, temperature: float, max_tokens: int, stream: bool
    ) -> dict:
        return {
            "model": self.model,
            "messages": [m.model_dump() for m in messages],
            "stream": stream,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }

    # -- LLMProvider ---------------------------------------------------------

    async def complete(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float,
        max_tokens: int,
    ) -> LLMResponse:
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                resp = await client.post(
                    "/api/chat",
                    json=self._payload(
                        messages, temperature=temperature, max_tokens=max_tokens, stream=False
                    ),
                )
                resp.raise_for_status()
                data = resp.json()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            raise self._unreachable(exc) from exc
        except httpx.HTTPStatusError as exc:
            raise AIProviderError(
                f"Ollama at {self.base_url} returned HTTP {exc.response.status_code} "
                f"for model {self.model} — is the model pulled? "
                f"(`ollama pull {self.model}`)"
            ) from exc
        except httpx.HTTPError as exc:
            raise self._unreachable(exc) from exc
        latency_ms = int((time.perf_counter() - started) * 1000)
        text = (data.get("message") or {}).get("content", "")
        return LLMResponse(text=text, model=self.model, latency_ms=latency_ms)

    async def stream(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float,
        max_tokens: int,
    ) -> AsyncIterator[str]:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    "/api/chat",
                    json=self._payload(
                        messages, temperature=temperature, max_tokens=max_tokens, stream=True
                    ),
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue  # skip partial NDJSON lines
                        chunk = (data.get("message") or {}).get("content")
                        if chunk:
                            yield chunk
                        if data.get("done"):
                            break
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            raise self._unreachable(exc) from exc
        except httpx.HTTPStatusError as exc:
            raise AIProviderError(
                f"Ollama at {self.base_url} returned HTTP {exc.response.status_code} "
                f"for model {self.model} — is the model pulled? "
                f"(`ollama pull {self.model}`)"
            ) from exc
        except httpx.HTTPError as exc:
            raise self._unreachable(exc) from exc

    async def is_available(self) -> bool:
        """Fast health probe used by AI_PROVIDER=auto detection."""
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=1.5) as client:
                resp = await client.get("/api/tags")
                return resp.status_code == 200
        except httpx.HTTPError:
            return False
