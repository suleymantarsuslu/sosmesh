#!/usr/bin/env bash
# Print api + migrate compose logs without echoing smoke secrets from the environment.
set -euo pipefail

COMPOSE_FILE="${1:-infra/deploy/compose/docker-compose.staging.yml}"

redact_stream() {
  sed -E \
    -e 's|postgresql://[^[:space:]"'\''@]+@|postgresql://[REDACTED]@|g' \
    -e 's|(JWT_SECRET[=:][[:space:]]*)[^[:space:]"'\'']+|\1[REDACTED]|gi' \
    -e 's|(INGEST_RECEIPT_SIGNING_PRIVATE_KEY[=:][[:space:]]*)[^[:space:]"'\'']+|\1[REDACTED]|gi' \
    -e 's|(POSTGRES_PASSWORD[=:][[:space:]]*)[^[:space:]"'\'']+|\1[REDACTED]|gi' \
    -e 's|(MODEL_API_KEY[=:][[:space:]]*)[^[:space:]"'\'']+|\1[REDACTED]|gi'
}

echo "=== docker compose logs (api, migrate) — secrets redacted ==="
docker compose -f "$COMPOSE_FILE" logs --no-color api migrate 2>&1 | redact_stream
