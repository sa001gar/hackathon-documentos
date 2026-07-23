#!/usr/bin/env bash
# Start both apps in dev mode (backend :8000, frontend :5173)
set -e
cd "$(dirname "$0")/.."

(cd apps/backend && uv run uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null' EXIT

pnpm --filter @documentos/frontend dev
