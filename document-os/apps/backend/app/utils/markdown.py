"""Markdown + text helpers shared across services and AI agents."""
import re
import unicodedata


def count_words(text: str) -> int:
    stripped = text.strip()
    return len(stripped.split()) if stripped else 0


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value or "untitled"


def make_snippet(text: str, query: str, *, radius: int = 80) -> str:
    """Return a short excerpt of text around the first (case-insensitive) match."""
    plain = re.sub(r"\s+", " ", text).strip()
    idx = plain.lower().find(query.lower())
    if idx == -1:
        return plain[: radius * 2]
    start = max(0, idx - radius)
    end = min(len(plain), idx + len(query) + radius)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(plain) else ""
    return f"{prefix}{plain[start:end]}{suffix}"


def sections_to_markdown(sections: list, title: str | None = None) -> str:
    """Render an ordered flat section list (with parent_id/order_index) to one markdown doc.

    `sections` items need: title, content, parent_id, order_index.
    """
    by_parent: dict[str | None, list] = {}
    for s in sections:
        by_parent.setdefault(s.parent_id, []).append(s)
    for children in by_parent.values():
        children.sort(key=lambda s: s.order_index)

    parts: list[str] = []
    if title:
        parts.append(f"# {title}\n")

    def walk(parent_id, depth):
        for s in by_parent.get(parent_id, []):
            level = min(depth + (2 if title else 1), 6)
            parts.append(f"{'#' * level} {s.title}\n")
            if s.content and s.content.strip():
                parts.append(s.content.strip() + "\n")
            walk(s.id, depth + 1)

    walk(None, 0)
    return "\n".join(parts)


def strip_markdown_fences(text: str) -> str:
    """Remove a single wrapping ```markdown ... ``` fence if the model added one."""
    stripped = text.strip()
    match = re.match(r"^```(?:markdown|md)?\s*\n(.*)\n```\s*$", stripped, re.DOTALL)
    return match.group(1) if match else stripped
