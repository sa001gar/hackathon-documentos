# DocumentOS — Dokploy Deployment Guide

## Deployment Architecture

```
Browser
  │
  ├── https://docos.sagarkundu.me ──► Traefik (Dokploy) ──► frontend:3000
  │                                                     (SPA — Node static server)
  │
  └── https://docos-api.sagarkundu.me ──► Traefik (Dokploy) ──► backend:8000
                                                              (FastAPI + AI engine)
                                                                │
                                                                └──► PostgreSQL
                                                                  (Dokploy-managed,
                                                                   external to compose)
```

- **Frontend** serves the built SPA via a zero-dependency Node.js server (`docker/serve.mjs`).
  The SPA makes API calls to `https://docos-api.sagarkundu.me/api/v1/...` (configurable via
  the `VITE_API_URL` build arg).
- **Backend** runs FastAPI via uvicorn with proxy-headers support. It connects to an
  existing PostgreSQL instance (Dokploy-managed, **not** part of this compose stack).
- **Traefik** (Dokploy's built-in reverse proxy) terminates TLS, manages Let's Encrypt
  certificates, and routes each domain to the correct container. No nginx, no Caddy, no Apache.
- **No Redis** — generation jobs run in-process; `REDIS_URL` is reserved for a future
  queue-backed worker pool.

---

## Required Dokploy Environment Variables

Set these in Dokploy → Compose → Environment:

| Variable | Example | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://user:pass@host:5432/documentos` | **Yes** | Existing PostgreSQL connection string. The backend auto-creates tables on first boot. |
| `JWT_SECRET` | `<any 64-char hex string>` | **Yes** | Secret key for signing JWT tokens. Generate with `openssl rand -hex 64`. |
| `GEMINI_API_KEY` | `AIza...` | **Yes** | Google AI Studio API key for Gemma 4. Get one at https://aistudio.google.com/apikey. |

### Optional Variables

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `auto` | Provider selection: `auto` / `google` / `ollama` / `openai` / `mock` |
| `GOOGLE_MODEL` | `gemma-4-26b-a4b-it` | Model name for Google AI SDK |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama server URL (only if using local Gemma) |
| `GEMMA_MODEL` | `gemma3` | Model name for Ollama |
| `CORS_ORIGINS` | `https://docos.sagarkundu.me` | Comma-separated list of allowed CORS origins |
| `VITE_API_URL` (build arg) | `https://docos-api.sagarkundu.me` | Backend origin for the frontend's API calls |

### Build-time Variables

`VITE_API_URL` is a Docker build arg (not a runtime env). It is inlined into the frontend
JS bundle during `pnpm build`. Change it → rebuild → redeploy.

---

## Deployment Steps

### 1. Create Application in Dokploy

1. Navigate to Dokploy dashboard → **Applications** → **Create**.
2. Select **Docker Compose**.
3. Name: `docos` (or your preference).

### 2. Configure Git Repository

1. Connect your Git repository (GitHub/GitLab/etc.) containing DocumentOS.
2. Branch: `main` (or your release branch).
3. Root path: `/` (the `docker-compose.yml` is at the repository root).

### 3. Configure Environment Variables

Under **Environment** → **Compose**, add:

```
DATABASE_URL=postgresql+psycopg2://user:pass@<dokploy-postgres-hostname>:5432/documentos
JWT_SECRET=<your-generated-secret>
GEMINI_API_KEY=AIza...
```

Optional but recommended:

```
CORS_ORIGINS=https://docos.sagarkundu.me
```

### 4. Configure Domains

Under **Domains**, add two entries:

| Domain | Type | Service | Port |
|---|---|---|---|
| `docos.sagarkundu.me` | HTTP | `frontend` | `3000` |
| `docos-api.sagarkundu.me` | HTTP | `backend` | `8000` |

Dokploy automatically configures Traefik with TLS (Let's Encrypt) for both domains.
Do NOT add path-based routing or path stripping — each domain routes to one service.

### 5. Deploy

Click **Deploy**. Dokploy will:
1. Clone the repository
2. Build both images using the Dockerfiles
3. Start the stack
4. Attach to the `dokploy-network`
5. Configure Traefik routes for both domains
6. Issue TLS certificates

### 6. Verify Health

```bash
# Backend health endpoint (direct)
curl https://docos-api.sagarkundu.me/health
# → {"status":"ok","service":"documentos-api","ai_provider":"google",...}

# Backend health via compose healthcheck
docker compose ps
# → Both services should show "(healthy)"

# Frontend
curl -o /dev/null -s -w "%{http_code}" https://docos.sagarkundu.me
# → 200
```

### 7. Seed Demo Data (optional)

```bash
# Exec into the running backend container:
docker compose exec backend python -m app.seed
# → Creates demo user: demo@documentos.ai / demo1234
```

---

## Health Verification

### Backend Health Endpoint

```
GET https://docos-api.sagarkundu.me/health
```

Expected response (200):
```json
{
  "status": "ok",
  "service": "documentos-api",
  "ai_provider": "google",
  "gemma_model": "gemma-4-26b-a4b-it"
}
```

### Docker Healthchecks

Both services have Docker-native healthchecks configured in `docker-compose.yml`:

- **Backend**: queries `/health` every 30s, 15s start period, 3 retries, 5s timeout.
- **Frontend**: performs an HTTP GET on `localhost:3000` every 30s, 15s start period.

### API Smoke Test

```bash
# Login
curl -X POST https://docos-api.sagarkundu.me/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=demo@documentos.ai&password=demo1234"
# → {"access_token":"...","token_type":"bearer",...}
```

---

## CORS Configuration

The frontend at `https://docos.sagarkundu.me` makes API calls to
`https://docos-api.sagarkundu.me`. The backend must accept these cross-origin requests.

- The docker-compose sets `CORS_ORIGINS=https://docos.sagarkundu.me` by default.
- To add additional origins (e.g., preview domains), comma-separate:
  ```
  CORS_ORIGINS=https://docos.sagarkundu.me,https://preview.sagarkundu.me
  ```
- The backend's `config.py` parses this into a list via `cors_origins_list`.

---

## Troubleshooting

### Traefik Labels / Routing

**Issue**: `503 Service Unavailable` on the domain.

Check that:
1. The container is running and healthy: `docker compose ps`
2. The Traefik labels in `docker-compose.yml` match your Dokploy setup.
3. The service name in the label matches the compose service name:
   - `traefik.http.services.docos-api.loadbalancer.server.port=8000` → compose service `backend`
   - `traefik.http.services.docos.loadbalancer.server.port=3000` → compose service `frontend`

**Dokploy note**: When using Traefik labels directly in compose, Dokploy may override
them with its own router configuration from the Domains tab. If you have configured
domains in the Dokploy UI, you can remove the Traefik labels from compose — Dokploy
generates them. The labels are provided as a fallback for advanced setups.

### DNS

**Issue**: Domain not resolving.

1. Verify DNS A/AAAA records point to your Dokploy server's IP.
2. Propagation can take minutes to hours depending on TTL.
3. Use `dig docos.sagarkundu.me` to verify resolution.

### TLS / Certificates

**Issue**: Certificate not issued / HTTPS not working.

1. Dokploy's Traefik automatically requests Let's Encrypt certificates for configured
   domains.
2. Ensure DNS resolves before TLS can be issued.
3. Check Dokploy logs for certificate errors.
4. First certificate issue may take 30-60 seconds after the container starts.

### Environment Variables

**Issue**: Backend fails to start / database connection error.

1. Verify `DATABASE_URL` is correct and the PostgreSQL instance is reachable from
   the Dokploy network.
2. The compose uses `${DATABASE_URL:?error}` — missing or empty `DATABASE_URL` causes
   the compose to fail immediately with a clear error.
3. Check PostgreSQL firewall rules — the Dokploy container network must be allowed.

### PostgreSQL Connectivity

**Issue**: `psycopg2.OperationalError: could not connect to server`.

1. Ensure the PostgreSQL instance is running in Dokploy and is on the same
   `dokploy-network`.
2. Use the PostgreSQL service's container name as the hostname (Dokploy's DNS resolves
   service names within the `dokploy-network`).
3. Example: `postgresql+psycopg2://user:pass@postgres:5432/documentos` where `postgres`
   is the name of the PostgreSQL service in Dokploy.

### Build Failures

**Issue**: Docker build fails.

1. Check Docker build logs in Dokploy.
2. Ensure the repository has `pnpm-lock.yaml` (for frontend) and `uv.lock` (for backend).
3. The frontend Dockerfile uses `--frozen-lockfile` — if the lockfile is out of sync,
   rebuild fails. Run `pnpm install` locally and commit the updated lockfile.
4. The backend Dockerfile uses `--frozen` — same constraint for `uv.lock`.

### Backend Health Check Fails

**Issue**: Backend container shows `unhealthy`.

1. Exec into the container and test manually:
   ```bash
   docker compose exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read())"
   ```
2. Check backend logs: `docker compose logs backend`
3. Most likely cause: database connection failure or missing required environment variable.

### Frontend Shows Blank Page

**Issue**: SPA loads but shows blank/error page.

1. Open browser DevTools → Console for JavaScript errors.
2. Check Network tab — API calls to `https://docos-api.sagarkundu.me` should succeed.
3. Verify `VITE_API_URL` build arg is correct (the JS bundle inlines this value).
4. If the API URL is wrong, rebuild with the correct value.

---

## Verification Checklist

- [ ] Frontend builds successfully (`pnpm --filter @documentos/frontend build`)
- [ ] Backend builds successfully (`docker build -f docker/Dockerfile.backend .`)
- [ ] Docker Compose validates (`docker compose config`)
- [ ] Backend health endpoint returns 200 (`GET /health`)
- [ ] Frontend serves index.html on `https://docos.sagarkundu.me`
- [ ] Backend responds on `https://docos-api.sagarkundu.me`
- [ ] Backend connects to existing PostgreSQL (no SQLite fallback in production)
- [ ] No PostgreSQL container is deployed
- [ ] No nginx / Caddy / Apache is used
- [ ] No local development workflow is modified
- [ ] `pnpm run dev` still works locally
- [ ] `uv run uvicorn ...` still works locally
- [ ] `.env` file is not required for production (Dokploy provides env vars)
- [ ] Production containers run as non-root users
- [ ] Logging is configured with rotation (max 3 × 10MB files)
