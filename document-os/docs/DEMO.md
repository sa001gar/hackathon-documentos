# DocumentOS — 5-minute demo script

## Setup (before the talk)

```bash
# 1. Install + run Gemma locally
ollama pull gemma3            # or: ollama pull gemma3:27b

# 2. Backend
cd apps/backend && cp .env.example .env
uv sync
uv run python -m app.seed    # demo@documentos.ai / demo1234
uv run uvicorn app.main:app --reload

# 3. Frontend (new terminal)
cd ../.. && pnpm install && pnpm dev:frontend   # http://localhost:5173
```

> No GPU? The app detects Ollama is unreachable and switches to a clearly-badged
> offline demo provider, so every flow below still works.

## Script

1. **Login** as `demo@documentos.ai` / `demo1234`. Point out the three-column workspace:
   navigation · editor · AI Inspector.
2. **Create from template** — "New Document" → pick **PRD** template → show the
   hierarchical tree materialize instantly (every section is its own versioned entity).
3. **AI generation** — open the empty "AI Hiring Platform PRD", press **Generate with AI**,
   prompt: *"An AI-powered hiring platform for startups"*. Watch the Planner build the
   outline, then sections stream in one-by-one (generation status per node in the tree).
4. **Inline refinement** — select a paragraph → floating toolbar → **Make professional**.
   Only that block changes. Show the version entry it created (source: `ai`).
5. **Validation + Review** — right panel → **Validate** (structured issues, per section)
   → **Review** (quality/readability/completeness scores + suggestions).
6. **Versioning** — open a section's version history, diff two versions, restore one.
7. **Autosave** — type; watch the "Saved · just now" indicator (debounced, optimistic).
8. **Command palette** — `Ctrl+K`: jump to any document, run actions, toggle theme.
9. **Export** — Export menu → PDF / DOCX / Markdown / HTML / JSON; download opens formatted file.
10. **Traceability** — Activity feed: every agent call (prompt, model, latency) is logged.

## Talking points

- *Not a document generator*: hierarchical tree, per-section regeneration, immutable versions.
- Six specialized Gemma agents with dedicated prompts, parsers, and structured outputs.
- AI is a first-class, auditable citizen: every action logged, every change versioned.
