#!/usr/bin/env bash
set -e

# ---------------------------------------------------------------------------
# Radar - Railway start script
# Single-service deploy: builds the React frontend, then runs FastAPI which
# serves both /api/* endpoints and the built frontend as static files.
# ---------------------------------------------------------------------------

# Defaults (Railway "Variables" tab will override any of these).
export MONGO_URL="${MONGO_URL:-mongodb+srv://nipun_db_user:R87Z513xxqJllYpf@cluster0.tgywovi.mongodb.net/?retryWrites=true&w=majority}"
export DB_NAME="${DB_NAME:-Cluster0}"
export SERPAPI_KEY="${SERPAPI_KEY:-a7c4cf8065b33a5ef7a57fb136034a51a9e7ef90706ea401037dc32d9ee64cba}"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"

# Load .env if present (local dev; Railway injects vars directly)
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

# Backend deps
pip install --no-cache-dir -r backend/requirements.txt

# Frontend build (same-origin: API served at /api on the same host)
export REACT_APP_BACKEND_URL=""
( cd frontend && yarn install --frozen-lockfile && yarn build )

# Hand off to FastAPI (binds to Railway's $PORT)
exec uvicorn server:app \
  --app-dir backend \
  --host 0.0.0.0 \
  --port "${PORT:-8001}"
