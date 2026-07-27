# DocOS — AI Document Operating System

**Built for the Google Gemma Hackathon.**

DocOS is not another AI document generator. It is an intelligent document workspace
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

| Conventional AI tools | DocOS |
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
- **13 built-in templates** (PRD, SRS, Research Paper, API Docs, SOP, Legal, …) — extensible

## Tech stack

**Frontend** — React 18 · TypeScript · Vite · Tailwind CSS · TipTap · TanStack Query ·
React Hook Form · Zod · Framer Motion · pnpm
**Backend** — FastAPI · SQLAlchemy 2.0 · Pydantic v2 · PostgreSQL/SQLite · Alembic · uv
**AI** — Gemma 4 via the Google AI SDK (`google-genai`), local Gemma via Ollama,
or any OpenAI-compatible server — behind one provider abstraction

---

## Run it manually (no Docker)

### Prereqs

- Node 20+ with **pnpm** (`corepack enable`)
- Python via **[uv](https://docs.astral.sh/uv/)** (manages its own Python 3.12)
- A Gemma runtime (pick one):
  - **Google AI SDK (Gemma 4, recommended)** — API key from <https://aistudio.google.com/apikey>
  - **Ollama** — `ollama pull gemma3` for local Gemma
  - **Neither** — the app falls back to a clearly-badged offline demo provider

### Backend

```bash
cd apps/backend
cp .env.example .env          # then edit .env:
                              #   GEMINI_API_KEY=your-key   (hosted Gemma 4)
                              #   DATABASE_URL=...          (external Postgres; SQLite default)
uv sync                       # install deps (auto-gets Python 3.12)
uv run python -m app.seed     # demo data → demo@DocOS.ai / demo1234
uv run uvicorn app.main:app --reload --port 8000
```

API: <http://localhost:8000> · interactive docs: <http://localhost:8000/docs> ·
health: <http://localhost:8000/health>

### Frontend (new terminal, repo root)

```bash
pnpm install
pnpm --filter @DocOS/frontend dev     # http://localhost:5173 (proxies /api → :8000)
```

Log in with **demo@DocOS.ai / demo1234**.
Shortcut: `pnpm dev` from the repo root starts both.

### Database migrations

Tables auto-create on first boot (zero-config dev). Alembic manages prod evolution:

```bash
cd apps/backend
uv run alembic stamp head                                # mark auto-created schema as baseline (once)
uv run alembic revision --autogenerate -m "add column"   # after changing app/models
uv run alembic upgrade head                              # apply migrations
uv run alembic current                                   # show current revision
```

Migrations read `DATABASE_URL` from `apps/backend/.env` — point it at your managed
Postgres to migrate the production database.

### Tests & checks

```bash
cd apps/backend && uv run pytest -q                 # 19 passed
pnpm --filter @DocOS/frontend build            # typecheck + production build
```

### Deploying (Dokploy)

Two images, no nginx — Dokploy's Traefik routes `/` → frontend:3000 and
`/api` → backend:8000. Set `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY` as
environment variables and deploy `docker-compose.yml`.
Full guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Check that it works

| Check | Command / action | Expected |
|---|---|---|
| Backend tests | `cd apps/backend && uv run pytest -q` | `19 passed` |
| Frontend build | `pnpm --filter @DocOS/frontend build` | builds with 0 TS errors |
| API health | `curl http://localhost:8000/health` | `{"status":"ok", "ai_provider":"google"\|"ollama"\|"mock", …}` |
| Login | `POST /api/v1/auth/login` (demo creds) | access + refresh tokens |
| AI pipeline | In-app: open "Payments API Reference" → **Generate with AI** | outline appears, sections fill in, status → `generated` |
| Export | In-app: Export → PDF | downloads a formatted PDF |

`ai_provider` in `/health` tells you which Gemma runtime the engine resolved
(`google` = Gemma 4 via Google AI SDK, `ollama` = local Gemma, `mock` = offline demo).

## Repo layout

```
apps/frontend   React SPA (three-column workspace: nav · editor · AI Inspector)
apps/backend    FastAPI service (clean architecture: api / services / repositories / ai / jobs)
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
- [docs/HACKATHON.md](docs/HACKATHON.md) — how Gemma powers each agent (all 3 runtimes)

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Frontend + backend in dev mode |
| `pnpm seed` | Create demo user, workspace, templates, sample docs |
| `pnpm test` | Backend test suite (19 tests) |
| `pnpm build` | Production build of all packages |
| `docker compose up` | App stack (API + web) against your external `DATABASE_URL` |
