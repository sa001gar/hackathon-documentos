# DocumentOS — Architecture

## Overview

DocumentOS is an AI-powered **document operating system**: documents are hierarchical trees of
independently versioned sections, and specialized Gemma agents (Planner, Writer, Refiner,
Validator, Reviewer, Exporter) operate on sections — never blindly on the whole document.

```
User Prompt → Planner Agent → Document Tree → Writer Agent (per section)
            → Validator → Reviewer → Versioning → Export
```

## Monorepo

```
apps/backend    FastAPI + SQLAlchemy 2.0 + Pydantic v2 (uv-managed, Python 3.12)
apps/frontend   React 18 + TypeScript + Vite + Tailwind + TipTap
packages/prompts        Prompt templates (markdown + frontmatter), DB-seeded, hot-editable
packages/shared-types   TS types mirroring the API contract
packages/utils          Framework-agnostic TS helpers
docker/                 Dockerfiles + nginx conf
docs/                   This file, API.md (the contract), DEMO.md
```

## Backend layers (clean architecture)

```
api/v1/endpoints  → HTTP only. No business logic, NO direct LLM calls.
services          → Business logic, orchestration, export rendering.
repositories      → Data access (BaseRepository + per-entity repos).
models / schemas  → SQLAlchemy tables / Pydantic DTOs.
ai/               → AI Engine. Only layer that talks to Gemma.
jobs/             → In-process async generation runner (resumable).
```

### AI Engine

`app.ai.engine.AIEngine` is the single entry point used by the API layer.

- **Providers** (`ai/providers/`): `ollama` (local Gemma via Ollama), `openai` (any
  OpenAI-compatible server: vLLM, llama.cpp, LM Studio), `mock` (deterministic, offline demo
  fallback — clearly flagged in logs). `AI_PROVIDER=auto` probes Ollama and falls back to mock.
- **Agents** (`ai/agents/`): each agent has a dedicated system prompt (DB-backed `ai_prompts`,
  seeded from `packages/prompts/*.md`, file fallback), independent config (temperature,
  max_tokens), a dedicated output parser, structured outputs (Pydantic), retry-on-parse-failure,
  and full logging to `ai_logs`.
- **Parsers** (`ai/parsers/`): robust JSON extraction (brace matching), schema validation,
  markdown fence stripping.

### Generation pipeline

`jobs.runner.job_runner` runs generation as an asyncio task:
plan (if needed) → create pending sections → Writer per section (retry up to
`AI_MAX_RETRIES`) → progress tracked on `generation_jobs` → completed/failed/cancelled.
On server startup, interrupted `running`/`pending` jobs resume from their first
incomplete section. Cancellation is cooperative (checked between sections).

## Key decisions (ADR-lite)

1. **Markdown is the source of truth** — sections store markdown; the editor converts
   markdown ↔ HTML (marked/turndown) at the boundary.
2. **Section-level versioning** — every content save (manual or AI) appends an immutable
   `document_versions` row; restore appends a new version (history is never rewritten).
3. **SQLite by default, PostgreSQL-ready** — portable types (String UUIDs, generic JSON);
   switch with `DATABASE_URL`. Alembic scaffolded for production migrations.
4. **In-process job runner by default** — zero-infra dev. Interface is swappable for a
   Redis/Celery backend (Redis included in docker-compose for that evolution).
5. **AI is always traceable** — every agent call writes an `ai_logs` row (prompt, response,
   model, latency, status) surfaced in the UI's activity feed.
6. **Demo resilience** — if Ollama/Gemma is unreachable, `auto` provider falls back to a
   deterministic mock provider so the product remains fully navigable; the UI badges this state.

## Database

Tables: `users, workspaces, projects, documents, document_sections, document_versions,
templates, ai_prompts, ai_logs, generation_jobs, exports, user_settings`.
`document_sections.parent_id` is a self-FK forming the tree (`order_index` for ordering).
