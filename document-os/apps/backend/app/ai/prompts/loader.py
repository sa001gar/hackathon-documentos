"""Prompt loading: DB registry (ai_prompts) → packages/prompts files → built-in defaults.

Prompt files use YAML-ish frontmatter (agent, name, temperature, max_tokens,
description) followed by the template body with {{variable}} placeholders.
"""
import logging
import re
import time
from pathlib import Path

from sqlalchemy.orm import Session

from app.ai.prompts.defaults import DEFAULT_CONFIG, DEFAULT_PROMPTS
from app.models import AIPrompt
from app.core.config import get_settings

logger = logging.getLogger("documentos.ai.prompts")

AGENTS = ("planner", "writer", "refiner", "validator", "reviewer", "exporter")

# Prompts change only via explicit re-seeding, so cache resolutions briefly.
# Without this every agent instantiation (once per generated section) hits the
# ai_prompts table — an N+1 pattern that costs real latency on remote Postgres.
_PROMPT_CACHE: dict[str, tuple[float, tuple[str, float, int]]] = {}
_CACHE_TTL_S = 60.0


def _prompts_dir() -> Path | None:
    """Resolve PROMPTS_DIR relative to CWD or the repo root."""
    raw = get_settings().PROMPTS_DIR
    candidates = [Path(raw)]
    # repo root = apps/backend/app/ai/prompts/loader.py → parents[5]
    candidates.append(Path(__file__).resolve().parents[5] / "packages" / "prompts")
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return None


def _parse_prompt_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    config: dict = {}
    body = text
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, flags=re.DOTALL)
    if match:
        frontmatter, body = match.groups()
        for line in frontmatter.splitlines():
            if ":" in line:
                key, _, value = line.partition(":")
                value = value.strip()
                if key.strip() in ("temperature",):
                    value = float(value)
                elif key.strip() in ("max_tokens",):
                    value = int(value)
                config[key.strip()] = value
    return {"config": config, "template": body.strip()}


def seed_prompts_from_files(db: Session) -> None:
    """Upsert packages/prompts/*.md into the ai_prompts registry (idempotent).

    Skips file processing entirely if all 6 agents already have prompts seeded.
    """
    from app.repositories import ai_prompt_repo  # lazy: avoid circulars at import time

    directory = _prompts_dir()
    if directory is None:
        logger.info("Prompts directory not found; using built-in defaults.")
        return

    # Fast-path: skip if all agents already have at least one prompt row
    from sqlalchemy import func, select
    seeded = db.scalar(select(func.count(AIPrompt.agent)).distinct())
    if seeded is not None and seeded >= len(AGENTS):
        return

    for path in sorted(directory.glob("*.md")):
        parsed = _parse_prompt_file(path)
        agent = parsed["config"].get("agent", path.stem)
        if agent not in AGENTS:
            continue
        ai_prompt_repo.upsert_version(
            db,
            agent=agent,
            name=parsed["config"].get("name", "default"),
            template=parsed["template"],
            description=parsed["config"].get("description"),
            temperature=float(parsed["config"].get("temperature", DEFAULT_CONFIG[agent]["temperature"])),
            max_tokens=int(parsed["config"].get("max_tokens", DEFAULT_CONFIG[agent]["max_tokens"])),
        )
    _PROMPT_CACHE.clear()  # seeded prompts must take effect immediately


def get_prompt(db: Session, agent: str) -> tuple[str, float, int]:
    """Return (template, temperature, max_tokens) for an agent.

    Resolution order: active DB prompt → prompt file → built-in default.
    Cached for _CACHE_TTL_S seconds — see _PROMPT_CACHE note above.
    """
    from app.repositories import ai_prompt_repo

    now = time.monotonic()
    hit = _PROMPT_CACHE.get(agent)
    if hit is not None and now - hit[0] < _CACHE_TTL_S:
        return hit[1]

    row = ai_prompt_repo.get_active(db, agent)
    if row is not None:
        result = (row.template, row.temperature, row.max_tokens)
    else:
        directory = _prompts_dir()
        result = None
        if directory is not None:
            path = directory / f"{agent}.md"
            if path.exists():
                parsed = _parse_prompt_file(path)
                result = (
                    parsed["template"],
                    float(parsed["config"].get("temperature", DEFAULT_CONFIG[agent]["temperature"])),
                    int(parsed["config"].get("max_tokens", DEFAULT_CONFIG[agent]["max_tokens"])),
                )
        if result is None:
            result = (
                DEFAULT_PROMPTS[agent],
                DEFAULT_CONFIG[agent]["temperature"],
                DEFAULT_CONFIG[agent]["max_tokens"],
            )

    _PROMPT_CACHE[agent] = (now, result)
    return result


def render(template: str, **variables: str) -> str:
    """Render {{variable}} placeholders; unknown placeholders are left intact."""
    def _replace(match: re.Match) -> str:
        key = match.group(1).strip()
        return str(variables.get(key, match.group(0)))

    return re.sub(r"\{\{\s*(\w+)\s*\}\}", _replace, template)
