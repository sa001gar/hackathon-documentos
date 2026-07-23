"""Base agent: prompt resolution, JSON extraction, error handling."""
import json
import re
from abc import ABC
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.ai.engine import GemmaEngine
from app.ai.prompts import get_system_prompt

T = TypeVar("T", bound=BaseModel)


class AgentParseError(Exception):
    pass


class BaseAgent(ABC):
    name: str = "base"

    def __init__(self, engine: GemmaEngine, prompt_override: str | None = None) -> None:
        self.engine = engine
        self.system_prompt = get_system_prompt(self.name, override=prompt_override)

    # -- response parsing -------------------------------------------------

    @staticmethod
    def extract_json(text: str) -> Any:
        """Extract the first JSON object/array from a model response.

        Tolerant to prose around the JSON and to markdown code fences.
        """
        cleaned = re.sub(r"```(?:json)?", "", text).replace("```", "")
        for opener, closer in (("{", "}"), ("[", "]")):
            start = cleaned.find(opener)
            if start == -1:
                continue
            depth = 0
            for i in range(start, len(cleaned)):
                ch = cleaned[i]
                if ch == opener:
                    depth += 1
                elif ch == closer:
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(cleaned[start : i + 1])
                        except json.JSONDecodeError:
                            break
        raise AgentParseError("No valid JSON found in model response")

    def parse_json(self, text: str, model: type[T]) -> T:
        data = self.extract_json(text)
        try:
            return model.model_validate(data)
        except ValidationError as exc:
            raise AgentParseError(f"JSON did not match schema: {exc}") from exc

    @staticmethod
    def strip_fences(text: str) -> str:
        """Remove markdown code fences wrapping an entire response."""
        cleaned = text.strip()
        m = re.match(r"^```(?:markdown|md)?\s*\n(?P<body>.*?)\n?```$", cleaned, flags=re.DOTALL)
        return m.group("body").strip() if m else cleaned
