"""Google AI SDK provider — hosted Gemma 4 via the `google-genai` package.

Uses the async (`client.aio`) interface. System prompts are passed as
`system_instruction`; assistant turns map to the `model` role. Google Search /
thinking tools are intentionally NOT enabled: DocumentOS agents need
deterministic, structured outputs, not grounded browsing.
"""
import asyncio
import time
from typing import AsyncIterator

from app.ai.schemas import LLMMessage, LLMResponse
from app.core.config import get_settings
from app.core.errors import AIProviderError


class GoogleAIProvider:
    name = "google"

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GOOGLE_MODEL
        if not self.api_key:
            raise AIProviderError(
                "GEMINI_API_KEY is not set — get a key at "
                "https://aistudio.google.com/apikey and add it to apps/backend/.env"
            )
        from google import genai  # lazy import: provider is optional at runtime

        self._genai = genai
        self._client = genai.Client(api_key=self.api_key)

    # -- helpers --------------------------------------------------------------

    def _convert(self, messages: list[LLMMessage]) -> tuple[str | None, list]:
        """Split our message list into (system_instruction, contents)."""
        types = self._genai.types
        system_parts = [m.content for m in messages if m.role == "system"]
        contents = []
        for m in messages:
            if m.role == "system":
                continue
            role = "model" if m.role == "assistant" else "user"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=m.content)])
            )
        system = "\n\n".join(system_parts) if system_parts else None
        return system, contents

    def _config(self, system: str | None, *, temperature: float, max_tokens: int):
        types = self._genai.types
        return types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

    @staticmethod
    def _wrap_errors(exc: Exception) -> AIProviderError:
        return AIProviderError(f"Google AI (Gemma 4) request failed: {exc}")

    # -- LLMProvider ----------------------------------------------------------

    async def complete(
        self, messages: list[LLMMessage], *, temperature: float, max_tokens: int
    ) -> LLMResponse:
        settings = get_settings()
        system, contents = self._convert(messages)
        started = time.perf_counter()
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config=self._config(system, temperature=temperature, max_tokens=max_tokens),
                ),
                timeout=settings.AI_REQUEST_TIMEOUT,
            )
            text = response.text or ""
            if not text.strip():
                # Try to surface safety feedback or finish reason
                reason = getattr(response, "finish_reason", None)
                feedback = getattr(response, "prompt_feedback", None)
                details = f"finish_reason={reason}"
                if feedback:
                    details += f" prompt_feedback={feedback}"
                raise AIProviderError(
                    f"Google AI returned empty content ({details}). Your prompt may have been blocked by safety filters. "
                    f"Try a different topic or rephrase your request."
                )
        except asyncio.TimeoutError:
            raise AIProviderError(
                f"Google AI (Gemma 4) request timed out after {settings.AI_REQUEST_TIMEOUT}s"
            )
        except AIProviderError:
            raise
        except Exception as exc:
            raise self._wrap_errors(exc) from exc
        latency_ms = int((time.perf_counter() - started) * 1000)
        return LLMResponse(text=text, model=self.model, latency_ms=latency_ms)

    async def stream(
        self, messages: list[LLMMessage], *, temperature: float, max_tokens: int
    ) -> AsyncIterator[str]:
        settings = get_settings()
        system, contents = self._convert(messages)
        try:
            stream = await asyncio.wait_for(
                self._client.aio.models.generate_content_stream(
                    model=self.model,
                    contents=contents,
                    config=self._config(system, temperature=temperature, max_tokens=max_tokens),
                ),
                timeout=settings.AI_REQUEST_TIMEOUT,
            )
            async for chunk in stream:
                text = chunk.text
                if text:
                    yield text
        except asyncio.TimeoutError:
            raise AIProviderError(
                f"Google AI (Gemma 4) stream timed out after {settings.AI_REQUEST_TIMEOUT}s"
            )
        except AIProviderError:
            raise
        except Exception as exc:
            raise self._wrap_errors(exc) from exc

    async def is_available(self) -> bool:
        """Cheap capability probe: a key is configured and a 1-token call succeeds."""
        if not self.api_key:
            return False
        try:
            probe = [LLMMessage(role="user", content="Reply with the word: ok")]
            await asyncio.wait_for(
                self.complete(probe, temperature=0, max_tokens=8), timeout=8
            )
            return True
        except Exception:
            return False
