"""Prompt loading: DB registry (ai_prompts) → packages/prompts files → built-in defaults.

Prompt files use YAML-ish frontmatter (agent, name, temperature, max_tokens,
description) followed by the template body with {{variable}} placeholders.
"""
import logging
import re
from pathlib import Path

from sqlalchemy.orm import Session

from app.ai.prompts.defaults import DEFAULT_CONFIG, DEFAULT_PROMPTS
from app.core.config import get_settings

logger = logging.getLogger("documentos.ai.prompts")

AGENTS = ("planner", "writer", "refiner", "validator", "reviewer", "exporter")


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
    """Upsert packages/prompts/*.md into the ai_prompts registry (idempotent)."""
    from app.repositories import ai_prompt_repo  # lazy: avoid circulars at import time

    directory = _prompts_dir()
    if directory is None:
        logger.info("Prompts directory not found; using built-in defaults.")
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


def get_prompt(db: Session, agent: str) -> tuple[str, float, int]:
    """Return (template, temperature, max_tokens) for an agent.

    Resolution order: active DB prompt → prompt file → built-in default.
    """
    from app.repositories import ai_prompt_repo

    row = ai_prompt_repo.get_active(db, agent)
    if row is not None:
        return row.template, row.temperature, row.max_tokens

    directory = _prompts_dir()
    if directory is not None:
        path = directory / f"{agent}.md"
        if path.exists():
            parsed = _parse_prompt_file(path)
            return (
                parsed["template"],
                float(parsed["config"].get("temperature", DEFAULT_CONFIG[agent]["temperature"])),
                int(parsed["config"].get("max_tokens", DEFAULT_CONFIG[agent]["max_tokens"])),
            )

    return DEFAULT_PROMPTS[agent], DEFAULT_CONFIG[agent]["temperature"], DEFAULT_CONFIG[agent]["max_tokens"]


def render(template: str, **variables: str) -> str:
    """Render {{variable}} placeholders; unknown placeholders are left intact."""
    def _replace(match: re.Match) -> str:
        key = match.group(1).strip()
        return str(variables.get(key, match.group(0)))

    return re.sub(r"\{\{\s*(\w+)\s*\}\}", _replace, template)
