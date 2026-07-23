"""BaseAgent: prompt resolution, provider call, parse-retry, AILog tracing.

Every specialized agent inherits this. Agents never touch the DB session beyond
reading their prompt config and writing their call log.
"""
import time
from typing import Callable, TypeVar

from sqlalchemy.orm import Session

from app.ai.parsers import AIParseError
from app.ai.prompts import get_prompt, render
from app.ai.providers import aget_provider
from app.ai.schemas import LLMMessage
from app.core.config import get_settings
from app.core.errors import AIProviderError

T = TypeVar("T")


class BaseAgent:
    """Dedicated system prompt + config + parser + tracing for one agent."""

    name: str = "base"

    def __init__(self, db: Session):
        template, self.temperature, self.max_tokens = get_prompt(db, self.name)
        self.system_prompt = template

    async def run(
        self,
        db: Session,
        *,
        user_prompt: str,
        system_vars: dict | None = None,
        parser: Callable[[str], T] | None = None,
        document_id: str | None = None,
        section_id: str | None = None,
    ) -> T | str:
        """Call the provider; parse + retry on structured outputs; always log."""
        from app.repositories import ai_log_repo  # lazy import: layering

        system = render(self.system_prompt, **(system_vars or {}))
        messages = [LLMMessage(role="system", content=system), LLMMessage(role="user", content=user_prompt)]
        provider = await aget_provider()
        max_attempts = get_settings().AI_MAX_RETRIES + 1

        raw_text = ""
        started = time.perf_counter()
        try:
            for attempt in range(max_attempts):
                response = await provider.complete(
                    messages, temperature=self.temperature, max_tokens=self.max_tokens
                )
                raw_text = response.text
                if parser is None:
                    result: T | str = raw_text
                    break
                try:
                    result = parser(raw_text)
                    break
                except AIParseError:
                    if attempt >= max_attempts - 1:
                        raise
                    messages = messages + [
                        LLMMessage(role="assistant", content=raw_text),
                        LLMMessage(
                            role="user",
                            content="Your previous reply was invalid — it did not contain valid JSON in the expected format. "
                            "Reply with ONLY a valid JSON object matching the schema, no other text, no code fences, no backticks.",
                        ),
                    ]
            latency_ms = int((time.perf_counter() - started) * 1000)
            ai_log_repo.create_log(
                db,
                document_id=document_id,
                section_id=section_id,
                agent=self.name,
                action=self.name,
                model=getattr(response, "model", provider.name),
                system_prompt=system[:8000],
                user_prompt=user_prompt[:8000],
                response=raw_text[:8000],
                latency_ms=latency_ms,
                status="success",
            )
            return result
        except AIParseError as exc:
            self._log_failure(db, ai_log_repo, system, user_prompt, raw_text, started, document_id, section_id, f"parse error: {exc}")
            raise AIProviderError(f"{self.name} agent returned invalid output after {max_attempts} attempts") from exc
        except AIProviderError as exc:
            self._log_failure(db, ai_log_repo, system, user_prompt, raw_text, started, document_id, section_id, str(exc))
            raise

    def _log_failure(self, db, ai_log_repo, system, user_prompt, raw_text, started, document_id, section_id, error) -> None:
        try:
            ai_log_repo.create_log(
                db,
                document_id=document_id,
                section_id=section_id,
                agent=self.name,
                action=self.name,
                model="",
                system_prompt=system[:8000],
                user_prompt=user_prompt[:8000],
                response=raw_text[:8000],
                latency_ms=int((time.perf_counter() - started) * 1000),
                status="error",
                error=error[:2000],
            )
        except Exception:
            pass  # logging must never mask the real error
