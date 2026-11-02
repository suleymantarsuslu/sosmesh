#!/usr/bin/env bash
# Restore from latest encrypted base backup (local staging directory only).

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
RESTORE_TARGET="${1:-}"

if [ -z "${SOSMESH_BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "restore-pitr: SOSMESH_BACKUP_ENCRYPTION_KEY must be set" >&2
  exit 1
fi
if [ -z "$RESTORE_TARGET" ]; then
  echo "usage: restore-pitr.sh <empty_pgdata_directory>" >&2
  exit 1
fi

shopt -s nullglob
CANDIDATES=("$BASE_DIR"/base-*.tar.gz.enc)
shopt -u nullglob
if [ "${#CANDIDATES[@]}" -eq 0 ]; then
  echo "restore-pitr: no base backup in $BASE_DIR" >&2
  exit 1
fi
LATEST="${CANDIDATES[0]}"
for f in "${CANDIDATES[@]}"; do
  if [[ "$f" -nt "$LATEST" ]]; then
    LATEST="$f"
  fi
done

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass "env:SOSMESH_BACKUP_ENCRYPTION_KEY" \
  -in "$LATEST" | tar -C "$WORKDIR" -xf -

mkdir -p "$RESTORE_TARGET"
tar -xzf "$WORKDIR/data/base.tar.gz" -C "$RESTORE_TARGET"
echo "restore-pitr: extracted $LATEST into $RESTORE_TARGET (apply WAL from $STORAGE_DIR/wal separately if PITR needed)"
