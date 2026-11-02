#!/usr/bin/env bash
# Automated backup → restore drill (ADIM 49). Real pg_dump/pg_restore via Prisma helper (no cloud).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/apps/api/test/.embedded-pg-env.json"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$ENV_FILE" ]; then
  export DATABASE_URL="$(node -e "const j=require(process.argv[1]); process.stdout.write(j.databaseUrl||'')" "$ENV_FILE")"
fi

cd "$REPO_ROOT/apps/api"
npx tsx test/helpers/backup-restore-drill.ts
