"""OpenAI-compatible provider — works with vLLM, llama.cpp, LM Studio, OpenAI."""
import json
import time
from typing import AsyncIterator

import httpx

from app.ai.schemas import LLMMessage, LLMResponse
from app.core.config import get_settings
from app.core.errors import AIProviderError


class OpenAICompatProvider:
    name = "openai"

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.OPENAI_BASE_URL.rstrip("/")
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.GEMMA_MODEL
        self.timeout = settings.AI_REQUEST_TIMEOUT

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _payload(self, messages: list[LLMMessage], *, temperature: float, max_tokens: int, stream: bool) -> dict:
        return {
            "model": self.model,
            "messages": [m.model_dump() for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }

    async def complete(
        self, messages: list[LLMMessage], *, temperature: float, max_tokens: int
    ) -> LLMResponse:
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                resp = await client.post(
                    "/chat/completions",
                    headers=self._headers(),
                    json=self._payload(messages, temperature=temperature, max_tokens=max_tokens, stream=False),
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as exc:
            raise AIProviderError(f"OpenAI-compatible endpoint at {self.base_url} failed: {exc}") from exc
        latency_ms = int((time.perf_counter() - started) * 1000)
        text = data["choices"][0]["message"]["content"] or ""
        return LLMResponse(text=text, model=self.model, latency_ms=latency_ms)

    async def stream(
        self, messages: list[LLMMessage], *, temperature: float, max_tokens: int
    ) -> AsyncIterator[str]:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    "/chat/completions",
                    headers=self._headers(),
                    json=self._payload(messages, temperature=temperature, max_tokens=max_tokens, stream=True),
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line.startswith("data:"):
                            continue
                        data_str = line[len("data:"):].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        chunk = delta.get("content")
                        if chunk:
                            yield chunk
        except httpx.HTTPError as exc:
            raise AIProviderError(f"OpenAI-compatible endpoint at {self.base_url} failed: {exc}") from exc
