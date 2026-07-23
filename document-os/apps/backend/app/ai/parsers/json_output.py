"""Robust JSON extraction + schema validation for agent outputs."""
import json

from app.ai.schemas import PlannerOutput
from app.schemas.ai import ReviewReport, ValidationIssue, ValidationReport


class AIParseError(Exception):
    """Raised when an agent response cannot be parsed into its schema."""

    def __init__(self, message: str, raw_text: str = ""):
        super().__init__(message)
        self.raw_text = raw_text


def _preview(text: str, max_len: int = 300) -> str:
    """First max_len characters of text, with newlines collapsed."""
    flat = " ".join(text.splitlines())
    return flat[:max_len] + ("..." if len(flat) > max_len else "")


def extract_json(text: str) -> dict | list:
    """Extract the first balanced JSON object/array from a model response.

    Tolerates markdown fences and surrounding prose; ignores braces inside strings.
    """
    cleaned = text.strip()
    # Strip leading/trailing markdown code fences (```json ... ``` or just ``` ... ```)
    import re as _re
    cleaned = _re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = _re.sub(r"\n?```\s*$", "", cleaned)
    cleaned = cleaned.strip()
    for opener, closer in (("{", "}"), ("[", "]")):
        start = cleaned.find(opener)
        if start == -1:
            continue
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(cleaned)):
            ch = cleaned[i]
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(cleaned[start : i + 1])
                    except json.JSONDecodeError as exc:
                        raise AIParseError(f"Invalid JSON payload: {exc}\nRaw preview: {_preview(text)}", text) from exc
    raise AIParseError(f"No JSON object found in response\nRaw preview: {_preview(text)}", text)


def parse_planner_output(text: str) -> PlannerOutput:
    data = extract_json(text)
    try:
        return PlannerOutput.model_validate(data)
    except Exception as exc:
        raise AIParseError(f"Planner output failed schema validation: {exc}", text) from exc


def parse_validation_report(text: str) -> tuple[bool, str, list[dict]]:
    """Return (is_valid, summary, raw issue dicts) — section title→id mapping happens in the engine."""
    data = extract_json(text)
    if not isinstance(data, dict):
        raise AIParseError("Validator output is not an object", text)
    try:
        is_valid = bool(data.get("is_valid", True))
        summary = str(data.get("summary", ""))
        issues = data.get("issues", [])
        # validate issue shape early
        [ValidationIssue.model_validate({**i, "section_id": None}) for i in issues]
        return is_valid, summary, issues
    except Exception as exc:
        raise AIParseError(f"Validator output failed schema validation: {exc}", text) from exc


def parse_review_report(text: str) -> ReviewReport:
    data = extract_json(text)
    try:
        return ReviewReport.model_validate(data)
    except Exception as exc:
        raise AIParseError(f"Reviewer output failed schema validation: {exc}", text) from exc
