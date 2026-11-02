#!/usr/bin/env bash
# Enforce retention on encrypted base backups and WAL archives.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=/dev/null
if [ -f "$BACKUP_ROOT/backup.env" ]; then
  # shellcheck disable=SC1091
  source "$BACKUP_ROOT/backup.env"
fi

STORAGE_DIR="${SOSMESH_BACKUP_STORAGE_DIR:-/tmp/sosmesh-backups}"
BASE_DIR="$STORAGE_DIR/${SOSMESH_BACKUP_BASE_SUBDIR:-base}"
WAL_DIR="$STORAGE_DIR/${SOSMESH_BACKUP_WAL_SUBDIR:-wal}"
MAX_BASE="${SOSMESH_BACKUP_RETENTION_MAX_BASE:-7}"
RETENTION_DAYS="${SOSMESH_BACKUP_RETENTION_WAL_DAYS:-7}"

mkdir -p "$BASE_DIR" "$WAL_DIR"

shopt -s nullglob
BASE_FILES=("$BASE_DIR"/base-*.tar.gz.enc)
shopt -u nullglob
if [ "${#BASE_FILES[@]}" -gt "$MAX_BASE" ]; then
  for ((i = MAX_BASE; i < ${#BASE_FILES[@]}; i++)); do
    rm -f "${BASE_FILES[$i]}"
  done
fi

find "$WAL_DIR" -type f -name '*.enc' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null
echo "rotate-retention: base cap=$MAX_BASE wal_days=$RETENTION_DAYS storage=$STORAGE_DIR"
