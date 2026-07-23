# DocumentOS — AI Document Operating System

**A hackathon MVP built for the Google Gemma Hackathon.**

DocumentOS is not another AI document generator. It is an intelligent document workspace
where documents are **hierarchical trees of independently versioned sections**, and a team of
specialized **Gemma agents** (Planner, Writer, Refiner, Validator, Reviewer, Exporter) helps you
create, refine, validate, version, and export professional documents.

```
User Prompt → Planner Agent → Document Tree → Writer (section-by-section)
            → Validate → Review → Version → Export
```

Think *Cursor × Notion × Google Docs*, purpose-built for professional documents:
PRDs, SRS, research papers, API docs, SOPs, proposals, legal agreements, and more.

## Why it's different

| Conventional AI tools | DocumentOS |
|---|---|
| One monolithic response | Hierarchical document tree |
| Regenerate everything | Regenerate exactly one section |
| No history | Immutable per-section version history with diffs + restore |
| Opaque AI | Every agent call logged & inspectable |
| Copy-paste export | One-click PDF / DOCX / HTML / Markdown / JSON |

## Features

- **Six Gemma agents**, each with dedicated prompts, parsers, structured outputs, retries
- **Hierarchical document tree** — every section independent, reorderable, regenerable
- **Inline AI toolbar** — select text → rewrite / improve / expand / shorten / 4 tone shifts /
  grammar fix / summarize / continue / translate (only the selection changes)
- **Streaming generation** — watch sections write themselves token by token
- **Validation & Review agents** — structural issue reports + quality/readability scores
- **Version everything** — manual and AI edits both create versions; diff & restore
- **Autosave** — debounced, optimistic, offline recovery via local snapshot
- **Command palette** (`Ctrl+K`), **dark mode**, skeleton loading, keyboard-first UX
- **12 built-in templates** (PRD, SRS, Research Paper, API Docs, SOP, Legal, …) — extensible

## Tech stack

**Frontend** — React 18 · TypeScript · Vite · Tailwind CSS · TipTap · TanStack Query ·
React Hook Form · Zod · Framer Motion · pnpm
**Backend** — FastAPI · SQLAlchemy 2.0 · Pydantic v2 · PostgreSQL/SQLite · Alembic · uv
**AI** — Gemma via Ollama (or any OpenAI-compatible server) behind a provider abstraction

## Quickstart

Prereqs: Node 20+ & pnpm, Python (via [uv](https://docs.astral.sh/uv/)),
[Ollama](https://ollama.com) for local Gemma.

```bash
# 0. Get Gemma
ollama pull gemma3

# 1. Backend
cd apps/backend
cp .env.example .env
uv sync
uv run python -m app.seed        # demo user: demo@documentos.ai / demo1234
uv run uvicorn app.main:app --reload

# 2. Frontend (new terminal)
cd ../..
pnpm install
pnpm dev:frontend                # http://localhost:5173
```

No GPU? No problem — the AI layer detects an unreachable Ollama and switches to a
clearly-badged offline demo provider, so every product flow remains usable.

### One-command options

```bash
pnpm dev            # run frontend + backend together (from repo root)
docker compose up   # full stack with PostgreSQL + Redis (Ollama on host)
```

## Repo layout

```
apps/frontend   React SPA (three-column workspace: nav · editor · AI Inspector)
apps/backend    FastAPI service (clean architecture: api / services / repositories / ai)
packages/prompts        Gemma prompt templates (DB-seeded, editable)
packages/shared-types   TypeScript API contract types
packages/utils          Shared TS helpers
docs/           ARCHITECTURE.md · API.md · DEMO.md · HACKATHON.md
docker/         Dockerfiles + nginx
scripts/        dev helpers
```

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — design & key decisions
- [docs/API.md](docs/API.md) — REST contract (v1)
- [docs/DEMO.md](docs/DEMO.md) — 5-minute judge demo script
- [docs/HACKATHON.md](docs/HACKATHON.md) — how Gemma powers each agent

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Frontend + backend in dev mode |
| `pnpm seed` | Create demo user, workspace, templates, sample doc |
| `pnpm test` | Backend test suite (pytest) |
| `pnpm build` | Production build of all packages |
| `docker compose up` | Full stack (Postgres + Redis + API + web) |
