#!/usr/bin/env bash
set -e

# Railway runtime entrypoint. Build (pip install + yarn build) is done by
# Railpack during the build phase — see /app/railpack.json.

# Default env (Railway "Variables" tab overrides these).
export MONGO_URL="${MONGO_URL:-mongodb+srv://nipun_db_user:R87Z513xxqJllYpf@cluster0.tgywovi.mongodb.net/?retryWrites=true&w=majority}"
export DB_NAME="${DB_NAME:-Cluster0}"
export SERPAPI_KEY="${SERPAPI_KEY:-a7c4cf8065b33a5ef7a57fb136034a51a9e7ef90706ea401037dc32d9ee64cba}"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"

exec python -m uvicorn server:app \
  --app-dir backend \
  --host 0.0.0.0 \
  --port "${PORT:-8001}"
