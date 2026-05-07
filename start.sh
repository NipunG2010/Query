#!/usr/bin/env bash
set -e

# ---------------------------------------------------------------------------
# Radar - Railway start script
# Single-service deploy: builds the React frontend, then runs FastAPI which
# serves both /api/* endpoints and the built frontend as static files.
# ---------------------------------------------------------------------------

# Load .env if present (Railway injects vars directly; this is for local use)
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

# Required env (set these in Railway → Variables):
#   MONGO_URL     e.g. mongodb+srv://user:pass@cluster.mongodb.net
#   DB_NAME       e.g. radar
#   SERPAPI_KEY   from https://serpapi.com/manage-api-key
#   CORS_ORIGINS  "*" or your domain
: "${MONGO_URL:?MONGO_URL not set}"
: "${DB_NAME:?DB_NAME not set}"
: "${SERPAPI_KEY:?SERPAPI_KEY not set}"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"

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
