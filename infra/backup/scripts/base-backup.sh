#!/usr/bin/env bash
# Create an encrypted pg_basebackup tarball under SOSMESH_BACKUP_STORAGE_DIR/base.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=/dev/null
if [ -f "$BACKUP_ROOT/backup.env" ]; then
  # shellcheck disable=SC1091
  source "$BACKUP_ROOT/backup.env"
fi

PG_URL="${SOSMESH_BACKUP_PG_URL:-${DATABASE_URL:-}}"
STORAGE_DIR="${SOSMESH_BACKUP_STORAGE_DIR:-/tmp/sosmesh-backups}"
BASE_DIR="$STORAGE_DIR/${SOSMESH_BACKUP_BASE_SUBDIR:-base}"
MAX_BASE="${SOSMESH_BACKUP_RETENTION_MAX_BASE:-7}"

if [ -z "$PG_URL" ]; then
  echo "base-backup: set SOSMESH_BACKUP_PG_URL or DATABASE_URL" >&2
  exit 1
fi
if [ -z "${SOSMESH_BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "base-backup: SOSMESH_BACKUP_ENCRYPTION_KEY must be set" >&2
  exit 1
fi

mkdir -p "$BASE_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

pg_basebackup -d "$PG_URL" -D "$WORKDIR/data" -Ft -z -X fetch -P

tar -C "$WORKDIR" -cf - data | openssl enc -aes-256-cbc -pbkdf2 -salt \
  -pass "env:SOSMESH_BACKUP_ENCRYPTION_KEY" \
  -out "$BASE_DIR/base-${STAMP}.tar.gz.enc"

shopt -s nullglob
OLD=("$BASE_DIR"/base-*.tar.gz.enc)
shopt -u nullglob
if [ "${#OLD[@]}" -gt "$MAX_BASE" ]; then
  for ((i = MAX_BASE; i < ${#OLD[@]}; i++)); do
    rm -f "${OLD[$i]}"
  done
fi

echo "base-backup: wrote $BASE_DIR/base-${STAMP}.tar.gz.enc"
