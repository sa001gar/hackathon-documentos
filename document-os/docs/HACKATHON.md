# How DocumentOS uses Gemma

DocumentOS is built around **Gemma as a team of specialized agents**, not a single chat call.

| Agent | Gemma's job | Output |
|---|---|---|
| Planner | Turn a user prompt into a hierarchical outline | Structured JSON tree |
| Writer | Write exactly one section, in context | Markdown |
| Refiner | Transform a selected block (12 actions: rewrite, tone shifts, grammar, expand, translate…) | Markdown fragment |
| Validator | Find missing sections, duplicates, terminology drift, broken references | Structured issue list |
| Reviewer | Score quality/readability/completeness, suggest improvements | Structured report |
| Exporter | Polish front matter / executive summary at export time | Markdown |

## Running Gemma

Any Gemma model served by **Ollama** works out of the box:

```bash
ollama pull gemma3          # default; or gemma3:27b, gemma2, …
```

Configuration (`apps/backend/.env`):

```
GEMMA_MODEL=gemma3            # swap freely, e.g. gemma3:27b or gemma4 when available
OLLAMA_BASE_URL=http://localhost:11434
AI_PROVIDER=auto              # ollama | openai | mock | auto
```

`AI_PROVIDER=openai` targets any OpenAI-compatible server (vLLM, llama.cpp, LM Studio)
serving Gemma weights. Prompts live in `packages/prompts/*.md`, are seeded into the
`ai_prompts` table, and can be edited without code changes.

## Why this is a good Gemma fit

- **Small-model friendly**: scoped tasks (one section, one block) beat monolithic prompts.
- **Structured outputs**: every agent's response is parsed into typed schemas with retries.
- **Auditable**: full prompt/response/latency logging per call (`ai_logs` + Activity UI).
- **Resilient**: provider abstraction with timeouts, retries, and graceful degradation.
