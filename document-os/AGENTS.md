# AGENTS.md — DocOS Knowledge Operating System contributor guide

Monorepo (pnpm + uv workspaces). **Read `docs/API.md` before changing any endpoint** — it is
the contract both sides implement. `packages/shared-types` mirrors it for TypeScript.

## Layout

- `apps/backend` — FastAPI, clean architecture: `api/v1/endpoints` (HTTP only) →
  `services` (business logic, plain functions, first arg `db: Session`) →
  `repositories` (singletons in `app/repositories/__init__.py`). `app/ai` owns ALL model
  access (providers/agents/parsers/prompts); `app/jobs` runs background generation.
- `apps/backend/app/ai/orchestration/` — **LangGraph orchestration engine**: stateful graph
  with intent routing, planning, research, writing, compliance, security, fact-check,
  review, style harmonization, and human approval gates. Checkpoints + resumable workflows.
- `apps/backend/app/ai/specialists/` — **20 AI Specialists** (Planner, Researcher, BA, PM,
  Architect, Backend/Frontend/DB Engineers, UX Reviewer, Tech Writer, Compliance Officer,
  Security Auditor, Fact Checker, Legal Reviewer, Performance Optimizer, Accessibility
  Reviewer, Translator, Teacher, Reviewer, Summarizer). Each has system prompt,
  capabilities, tools, memory scopes, context requirements, and responsibilities.
- `apps/backend/app/models/knowledge_graph.py` — **Knowledge Graph**: `kg_nodes` and `kg_edges`
  tables. Everything connects: requirements ↔ features ↔ APIs ↔ docs ↔ decisions ↔ tests.
  Impact analysis answers "what breaks if I remove this?"
- `apps/backend/app/models/memory.py` — **Persistent Memory**: `memory_items` table with
  user/project/workspace/organization scopes. Semantic search across all memory layers.
- `apps/backend/app/models/decision.py` — **Decision Intelligence**: `decisions` table
  with ADR records (context, rationale, alternatives, trade-offs, risks, assumptions).
- `apps/backend/app/services/context_engine.py` — **Context Engine**: auto-gathers context
  from memory layers, knowledge graph, past decisions, user preferences. Avoids asking
  users to repeat themselves.
- `apps/backend/app/services/impact_analysis.py` — **Impact Analysis**: trace what affects
  and depends on any node. BFS traversal up to configurable depth.
- `apps/backend/app/services/knowledge_health.py` — **Knowledge Health Score**: 6 metrics
  (outdated docs, test coverage, contradictions, duplicates, broken refs, completeness).
- `apps/backend/app/services/organization_brain.py` — **Organization Brain**: natural
  language Q&A over the knowledge graph ("why was this built?", "what depends on X?").
- `apps/backend/app/services/explainability.py` — **Explainable AI**: provenance tracking.
  Every AI run records sources, assumptions, confidence, requirements satisfied.
- `apps/frontend` — React 18 + TS + Vite. `src/components/ui` (shadcn-style),
  `src/features/*` (feature folders, colocated hooks/components), `src/lib`
  (api-client, stores), `src/hooks`. TanStack Query for server state, zustand for UI state.
- `apps/frontend/src/features/knowledge-graph/` — Knowledge Graph panel, Health Score
  dashboard, Organization Brain Q&A, Decision Log, Memory Browser.
- `apps/frontend/src/features/ai-inspector/` — Updated with 8 tabs: Outline, Prompts,
  Review, Graph, Health, Brain, Decisions, Memory.
- `packages/prompts` — agent prompt templates (frontmatter + body, `{{var}}` placeholders);
  seeded into `ai_prompts` at startup. Edit prompts here, not in code.

## Commands

- Backend: `cd apps/backend && uv sync && uv run pytest -q && uv run uvicorn app.main:app --reload`
- Seed: `uv run python -m app.seed` (demo@documentos.ai / demo1234)
- Frontend: `pnpm install && pnpm --filter @documentos/frontend dev` (build gate: `... build`;
  unit tests: `pnpm --filter @documentos/frontend test` — vitest+jsdom, covers the markdown
  round-trip contract in `src/lib/markdown.test.ts`)

## New API Endpoints

| Prefix | Tags | Purpose |
|--------|------|---------|
| `/api/v1/kg/` | knowledge-graph | Knowledge Graph CRUD + impact analysis + search |
| `/api/v1/memory/` | memory | Persistent memory CRUD + semantic search |
| `/api/v1/decisions/` | decisions | Decision Intelligence (ADR) CRUD |
| `/api/v1/orchestrate/` | orchestration | LangGraph workflow execution + specialists |
| `/api/v1/health-score/` | health-score | Knowledge Health Score per workspace |
| `/api/v1/brain/` | organization-brain | Q&A over knowledge graph + memory |
| `/api/v1/context/` | context | Context Engine (auto-gather) |
| `/api/v1/explain/` | explainability | AI run provenance tracking |

## New Models

- `KGNode` — knowledge graph vertices (documents, features, APIs, requirements, etc.)
- `KGEdge` — knowledge graph edges (implements, depends_on, affects, relates_to, etc.)
- `MemoryItem` — scoped persistent memory (user/project/workspace/organization)
- `Decision` — architectural decision records with full provenance

## Rules

- **Never call an LLM outside `app/ai`** — endpoints use `get_ai_engine()` / `job_runner`.
- Every content save goes through `section_service.update_content` (it appends a version).
- Errors: raise `AppError` subclasses from services, never `HTTPException`.
- DB models use String UUID PKs + generic JSON columns (SQLite dev / Postgres prod compatible).
- Tests must not import `app.main` unless they need the HTTP layer; set
  `DATABASE_URL`/`AI_PROVIDER=mock` env before app imports (see `tests/conftest.py`).
- Frontend: reuse `lib/api-client.ts` endpoint groups; no ad-hoc `fetch`.
- **LangGraph multi-agent workflows**: use `app/ai/orchestration/graph.py` for any
  multi-step AI pipeline. Add new nodes to `nodes.py` and register in `create_orchestration_graph()`.
- **Knowledge Graph**: every new entity model should have a corresponding auto-sync
  in `knowledge_graph_service.get_or_create_node()` to keep the graph in sync.
- **Memory**: use `memory_service.store_memory()` to persist user/project/org context.
  The context engine auto-gathers all memory for every AI request.
