# AGENTS.md — DocumentOS contributor guide

Monorepo (pnpm + uv workspaces). **Read `docs/API.md` before changing any endpoint** — it is
the contract both sides implement. `packages/shared-types` mirrors it for TypeScript.

## Layout

- `apps/backend` — FastAPI, clean architecture: `api/v1/endpoints` (HTTP only) →
  `services` (business logic, plain functions, first arg `db: Session`) →
  `repositories` (singletons in `app/repositories/__init__.py`). `app/ai` owns ALL model
  access (providers/agents/parsers/prompts); `app/jobs` runs background generation.
- `apps/frontend` — React 18 + TS + Vite. `src/components/ui` (shadcn-style),
  `src/features/*` (feature folders, colocated hooks/components), `src/lib`
  (api-client, stores), `src/hooks`. TanStack Query for server state, zustand for UI state.
- `packages/prompts` — agent prompt templates (frontmatter + body, `{{var}}` placeholders);
  seeded into `ai_prompts` at startup. Edit prompts here, not in code.

## Commands

- Backend: `cd apps/backend && uv sync && uv run pytest -q && uv run uvicorn app.main:app --reload`
- Seed: `uv run python -m app.seed` (demo@documentos.ai / demo1234)
- Frontend: `pnpm install && pnpm --filter @documentos/frontend dev` (build gate: `... build`)

## Rules

- **Never call an LLM outside `app/ai`** — endpoints use `get_ai_engine()` / `job_runner`.
- Every content save goes through `section_service.update_content` (it appends a version).
- Errors: raise `AppError` subclasses from services, never `HTTPException`.
- DB models use String UUID PKs + generic JSON columns (SQLite dev / Postgres prod compatible).
- Tests must not import `app.main` unless they need the HTTP layer; set
  `DATABASE_URL`/`AI_PROVIDER=mock` env before app imports (see `tests/conftest.py`).
- Frontend: reuse `lib/api-client.ts` endpoint groups; no ad-hoc `fetch`.
