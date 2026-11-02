#!/usr/bin/env bash
# Extract PostgreSQL 16 client tools (pg_dump/pg_restore) without sudo (Zulal-safe).
set -euo pipefail

ROOT="${SOSMESH_PGCLIENT_ROOT:-${RUNNER_TEMP:-/tmp}/pgclient}"
WORKDIR="${SOSMESH_PGCLIENT_WORK:-${RUNNER_TEMP:-/tmp}/pgclient-dl}"

rm -rf "$ROOT" "$WORKDIR"
mkdir -p "$ROOT" "$WORKDIR"
cd "$WORKDIR"

apt-get download postgresql-client-16 postgresql-client-common libpq5

shopt -s nullglob
for deb in ./*.deb; do
  dpkg -x "$deb" "$ROOT"
done
shopt -u nullglob

PG_DUMP_BIN="$(find "$ROOT" -name pg_dump -type f | head -1)"
PG_RESTORE_BIN="$(find "$ROOT" -name pg_restore -type f | head -1)"
if [ -z "$PG_DUMP_BIN" ] || [ -z "$PG_RESTORE_BIN" ]; then
  echo "bootstrap-pgclient-16: pg_dump/pg_restore not found under $ROOT" >&2
  exit 1
fi

PG_BIN_DIR="$(dirname "$PG_DUMP_BIN")"
LIBPQ="$(find "$ROOT" -name 'libpq.so.5*' | head -1)"
if [ -z "$LIBPQ" ]; then
  echo "bootstrap-pgclient-16: libpq.so.5 not found under $ROOT" >&2
  exit 1
fi
LIB_DIR="$(dirname "$LIBPQ")"

export PATH="$PG_BIN_DIR:$PATH"
export LD_LIBRARY_PATH="${LIB_DIR}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

if [ -n "${GITHUB_PATH:-}" ]; then
  echo "$PG_BIN_DIR" >> "$GITHUB_PATH"
fi
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH}" >> "$GITHUB_ENV"
  echo "SOSMESH_PGCLIENT_ROOT=${ROOT}" >> "$GITHUB_ENV"
fi

pg_dump --version
pg_restore --version
