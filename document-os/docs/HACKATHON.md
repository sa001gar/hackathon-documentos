# How DocumentOS uses Gemma

DocumentOS is built around **Gemma as a team of specialized agents**, not a single chat call.

| Agent | Gemma's job | Output |
|---|---|---|
| Planner | Turn a user prompt into a hierarchical outline | Structured JSON tree |
| Writer | Write exactly one section, in context | Markdown |
| Refiner | Transform a selected block (12 actions: rewrite, tone shifts, grammar, expand, translate…) | Markdown fragment |
| Validator | Find missing sections, duplicates, terminology drift, broken references | Structured issue list |
| Reviewer | Score quality/readability/completeness, suggest improvements | Structured report |
| Exporter | Write the executive summary for export front matter | Markdown |

## Option 1 — Gemma 4 via the Google AI SDK (recommended)

Hosted **Gemma 4** through the official [`google-genai`](https://pypi.org/project/google-genai/) SDK.
Get a key at <https://aistudio.google.com/apikey>, then in `apps/backend/.env`:

```bash
GEMINI_API_KEY=your-key-here
GOOGLE_MODEL=gemma-4-26b-a4b-it
AI_PROVIDER=auto        # auto picks Google AI when GEMINI_API_KEY is set
```

The provider (`app/ai/providers/google_ai.py`) uses the SDK's async interface
(`client.aio.models.generate_content` / `generate_content_stream`) with system prompts passed
as `system_instruction`. Search/thinking tools are deliberately disabled — DocumentOS agents
need deterministic, structured outputs, not grounded browsing.

## Option 2 — Gemma locally via Ollama

```bash
ollama pull gemma3        # or gemma3:27b, gemma2, …
```

```bash
OLLAMA_BASE_URL=http://localhost:11434
GEMMA_MODEL=gemma3
```

## Option 3 — any OpenAI-compatible server

vLLM, llama.cpp, or LM Studio serving Gemma weights:

```bash
AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8001/v1
GEMMA_MODEL=gemma3
```

## Resolution order (`AI_PROVIDER=auto`)

```
GEMINI_API_KEY set?  →  Google AI (Gemma 4)
Ollama reachable?    →  Ollama (local Gemma)
otherwise            →  mock provider (offline demo, clearly badged)
```

Prompts live in `packages/prompts/*.md`, are seeded into the `ai_prompts` table, and can be
edited without code changes. Every call is logged to `ai_logs` (prompt, response, model,
latency, status) and surfaced in the app's Activity feed.

## Why this is a good Gemma fit

- **Small-model friendly**: scoped tasks (one section, one block) beat monolithic prompts.
- **Structured outputs**: every agent's response is parsed into typed schemas with retries.
- **Auditable**: full prompt/response/latency logging per call.
- **Resilient**: provider abstraction with timeouts, retries, and graceful degradation.
