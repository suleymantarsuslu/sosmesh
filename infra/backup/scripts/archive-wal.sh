#!/usr/bin/env bash
# Encrypt and store a WAL segment under SOSMESH_BACKUP_STORAGE_DIR/wal with rotation.
# archive_command args: %p (full path to WAL file), %f (WAL file name only).

set -euo pipefail

WAL_PATH="${1:?WAL path required}"
WAL_NAME="${2:?WAL name required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=/dev/null
if [ -f "$BACKUP_ROOT/backup.env" ]; then
  # shellcheck disable=SC1091
  source "$BACKUP_ROOT/backup.env"
fi

STORAGE_DIR="${SOSMESH_BACKUP_STORAGE_DIR:-/tmp/sosmesh-backups}"
WAL_DIR="$STORAGE_DIR/${SOSMESH_BACKUP_WAL_SUBDIR:-wal}"
RETENTION_DAYS="${SOSMESH_BACKUP_RETENTION_WAL_DAYS:-7}"

if [ -z "${SOSMESH_BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "archive-wal: SOSMESH_BACKUP_ENCRYPTION_KEY must be set (secret name: ${SOSMESH_BACKUP_ENCRYPTION_KEY_SECRET_NAME:-sosmesh-backup-aes256})" >&2
  exit 1
fi

mkdir -p "$WAL_DIR"
DEST="$WAL_DIR/${WAL_NAME}.enc"
openssl enc -aes-256-cbc -pbkdf2 -salt \
  -pass "env:SOSMESH_BACKUP_ENCRYPTION_KEY" \
  -in "$WAL_PATH" \
  -out "$DEST"

find "$WAL_DIR" -type f -name '*.enc' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null
exit 0
