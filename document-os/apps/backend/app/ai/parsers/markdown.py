"""Markdown cleanup for agent outputs (writer/refiner/exporter)."""
import re

from app.utils.markdown import strip_markdown_fences

_PREAMBLE_PATTERNS = (
    r"^(here\s+(is|are)\b.*)",
    r"^(sure[,!]?\s.*)",
    r"^(certainly[,!]?\s.*)",
    r"^(of course[,!]?\s.*)",
    r"^(below\s+is\b.*)",
)


def clean_markdown_output(text: str) -> str:
    """Strip wrapping fences and chatty preambles from a markdown response."""
    cleaned = strip_markdown_fences(text).strip()
    lines = cleaned.split("\n")
    while lines:
        first = lines[0].strip()
        if not first:
            lines.pop(0)
            continue
        if any(re.match(pattern, first, flags=re.IGNORECASE) for pattern in _PREAMBLE_PATTERNS):
            lines.pop(0)
            continue
        break
    return "\n".join(lines).strip()
