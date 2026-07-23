# DocumentOS — 5-minute demo script

## Setup (before the talk)

```bash
# 1. Pick a Gemma runtime (one of):
#    a) Google AI SDK — hosted Gemma 4 (recommended):
#       put GEMINI_API_KEY=<key> in apps/backend/.env   (https://aistudio.google.com/apikey)
#    b) Local: ollama pull gemma3
#    c) Neither: the app falls back to a clearly-badged offline demo provider.

# 2. Backend
cd apps/backend && cp .env.example .env
uv sync
uv run python -m app.seed    # demo@documentos.ai / demo1234
uv run uvicorn app.main:app --reload

# 3. Frontend (new terminal)
cd ../.. && pnpm install && pnpm dev:frontend   # http://localhost:5173
```

Check the AI provider the server resolved: `curl http://localhost:8000/health`
(`"ai_provider": "google"` = Gemma 4, `"ollama"` = local Gemma, `"mock"` = offline demo).

## Script

1. **Login** as `demo@documentos.ai` / `demo1234`. Point out the three-column workspace:
   navigation · editor · AI Inspector.
2. **Create from template** — Templates → **PRD** → show the hierarchical tree materialize
   instantly (every section is its own versioned entity).
3. **AI generation** — open "Payments API Reference" (outline only), press **Generate with AI**,
   prompt: *"REST API for a payments service with idempotent charges"*. The Planner builds the
   outline, then sections stream in one-by-one (per-node generation status in the tree).
4. **Inline refinement** — select a paragraph → floating toolbar → **Professional**.
   Only that block changes. Show the version entry it created (source: `ai`).
5. **Validation + Review** — right panel → **Validate** (structured issues, per section)
   → **Review** (quality/readability/completeness scores + suggestions).
6. **Versioning** — open a section's version history, diff two versions, restore one.
7. **Autosave** — type; watch the "Saved · just now" indicator (debounced, optimistic).
8. **Command palette** — `Ctrl+K`: jump to any document, run actions, toggle theme.
9. **Export** — Export menu → PDF / DOCX / Markdown / HTML / JSON (optional AI executive summary).
10. **Traceability** — Activity feed: every agent call (prompt, model, latency) is logged.

## Talking points

- *Not a document generator*: hierarchical tree, per-section regeneration, immutable versions.
- Six specialized Gemma agents with dedicated prompts, parsers, and structured outputs.
- AI is a first-class, auditable citizen: every action logged, every change versioned.
- Runs on hosted Gemma 4 (Google AI SDK), local Gemma (Ollama), or anything OpenAI-compatible.
