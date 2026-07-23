# Deploying DocumentOS on Dokploy

The compose stack is **application-only** — two images, no nginx (Dokploy's Traefik handles
routing and TLS), no local Postgres/Redis (external URLs via environment).

- `docker/Dockerfile.backend` — FastAPI via uv (port **8000**)
- `docker/Dockerfile.frontend` — SPA build + zero-dependency Node static server (port **3000**)

## 1. Environment variables (Dokploy → Compose → Environment)

| Variable | Example | Required |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://user:pass@<dokploy-postgres>:5432/documentos` | yes (managed PG) |
| `JWT_SECRET` | any long random string | yes (prod) |
| `GEMINI_API_KEY` | from https://aistudio.google.com/apikey | for hosted Gemma 4 |
| `GOOGLE_MODEL` | `gemma-4-26b-a4b-it` (default) | no |
| `REDIS_URL` | `redis://<host>:6379/0` | no — reserved; job runner is in-process |
| `OLLAMA_BASE_URL` | `http://<host>:11434` | only if running local Gemma |
| `CORS_ORIGINS` | `https://docs.yourdomain.com` | no (API is same-origin via Traefik) |

> If `DATABASE_URL` is unset, the backend falls back to SQLite on the `backend-data`
> volume — fine for a demo; use managed Postgres for anything real.

## 2. Dokploy setup

1. **Create → Compose**, point at this repo (`docker-compose.yml` at root). Deploy.
2. **Domains** (Dokploy configures Traefik for you — no labels, no nginx):
   - Route 1: host `docs.yourdomain.com`, path `/`, service **frontend**, port **3000**
   - Route 2: host `docs.yourdomain.com`, path `/api`, service **backend**, port **8000**

   The SPA calls the API at the relative path `/api/v1/…`, so both routes on the same
   host make everything same-origin (no CORS, no cookies issues). Do NOT enable path
   stripping — the backend serves under `/api` itself.
3. Volumes `exports` (generated files) and `backend-data` (SQLite fallback) persist
   across redeploys.

## 3. Database migrations

Tables are created automatically on first boot for greenfield deployments. Alembic is
scaffolded for schema evolution — exec into the **backend** container:

```bash
# Mark the auto-created schema as the baseline (run once after first boot)
uv run alembic stamp head

# Later, after model changes:
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```

Alternative for a truly fresh database: skip the auto-create and run
`uv run alembic upgrade head` (the `0001_baseline` migration builds every table).

## 4. After deploy

```bash
curl https://docs.yourdomain.com/api/../health   # or directly: https://<backend>/health
# → {"status":"ok","ai_provider":"google", ...}

# Optional demo content — exec into the backend container once:
uv run python -m app.seed    # demo@documentos.ai / demo1234
```

## 5. Notes

- **No Redis needed**: generation jobs are in-process asyncio tasks that resume after
  restarts; `REDIS_URL` is accepted for a future queue backend.
- Scale-out (multiple backend replicas) would move the job runner to a Redis queue —
  the interface (`app/jobs/runner.py`) is designed for that swap.
- The frontend image contains only static files + a 60-line Node server
  (`docker/serve.mjs`) — nothing else to secure or configure.
