#!/usr/bin/env bash
set -euo pipefail

# check-schema-drift.sh
# Verifies that the Prisma schema matches the actual database schema after migrations.
# Exit 0 if no drift; exit 1 if drift detected.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable must be set" >&2
  exit 1
fi

echo "Checking for schema drift between database and schema.prisma..."
echo "Database: ${DATABASE_URL%%\?*}" # Hide query params

cd "$API_DIR"

# Run diff and capture output
DIFF_OUTPUT=$(../../node_modules/.pnpm/node_modules/.bin/prisma migrate diff \
  --from-url "${DATABASE_URL}" \
  --to-schema-datamodel prisma/schema.prisma \
  --script 2>&1 || true)

# Check if diff is empty (no drift)
if echo "$DIFF_OUTPUT" | grep -qE '^(--|CREATE|ALTER|DROP)'; then
  echo "❌ Schema drift detected!" >&2
  echo "$DIFF_OUTPUT" >&2
  exit 1
else
  echo "✅ No schema drift detected"
  exit 0
fi
