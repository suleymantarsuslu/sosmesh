#!/usr/bin/env bash
# Bootstrap pg_dump/pg_restore matching SOSMESH_CI_DATABASE_URL server major (no sudo).
set -euo pipefail

RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"
ROOT="${SOSMESH_PGCLIENT_ROOT:-${RUNNER_TEMP}/pgclient}"
WORKDIR="${SOSMESH_PGCLIENT_WORK:-${RUNNER_TEMP}/pgclient-dl}"
PROBE_ROOT="${RUNNER_TEMP}/pgclient-probe"
PROBE_WORK="${RUNNER_TEMP}/pgclient-probe-dl"

DATABASE_URL="${SOSMESH_CI_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DATABASE_URL" ]; then
  echo "bootstrap-pgclient: SOSMESH_CI_DATABASE_URL or DATABASE_URL is required" >&2
  exit 1
fi

extract_debs() {
  local dest=$1
  shift
  shopt -s nullglob
  for deb in "$@"; do
    dpkg -x "$deb" "$dest"
  done
  shopt -u nullglob
}

wire_client_env() {
  local root=$1
  PG_DUMP_BIN="$(find "$root" -name pg_dump -type f | head -1)"
  PG_RESTORE_BIN="$(find "$root" -name pg_restore -type f | head -1)"
  if [ -z "$PG_DUMP_BIN" ] || [ -z "$PG_RESTORE_BIN" ]; then
    echo "bootstrap-pgclient: pg_dump/pg_restore not found under $root" >&2
    exit 1
  fi
  PG_BIN_DIR="$(dirname "$PG_DUMP_BIN")"
  LIBPQ="$(find "$root" -name 'libpq.so.5*' | head -1)"
  if [ -z "$LIBPQ" ]; then
    echo "bootstrap-pgclient: libpq not found under $root" >&2
    exit 1
  fi
  LIB_DIR="$(dirname "$LIBPQ")"
  export PATH="$PG_BIN_DIR:$PATH"
  export LD_LIBRARY_PATH="${LIB_DIR}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
}

download_ubuntu_client_debs() {
  local major=$1
  local workdir=$2
  mkdir -p "$workdir"
  (
    cd "$workdir"
    apt-get download "postgresql-client-${major}" postgresql-client-common libpq5 >&2
  )
}

setup_pgdg_apt() {
  PGDG_APT_ROOT="${RUNNER_TEMP}/pgdg-apt"
  mkdir -p "$PGDG_APT_ROOT/lists/partial" "$PGDG_APT_ROOT/cache/archives" "$PGDG_APT_ROOT/cache/pkgcache.bin"
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o "$PGDG_APT_ROOT/pgdg.asc"
  echo "deb [signed-by=${PGDG_APT_ROOT}/pgdg.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" \
    >"$PGDG_APT_ROOT/sources.list"
  PGDG_APT_OPTS=(
    -o "Dir::Etc::sourcelist=${PGDG_APT_ROOT}/sources.list"
    -o Dir::Etc::sourceparts=-
    -o "Dir::State::Lists=${PGDG_APT_ROOT}/lists"
    -o "Dir::Cache=${PGDG_APT_ROOT}/cache"
    -o "Dir::Cache::archives=${PGDG_APT_ROOT}/cache/archives"
    -o Dir::Etc::trustedparts=-
  )
}

download_pgdg_client_debs() {
  local major=$1
  local workdir=$2
  setup_pgdg_apt
  mkdir -p "$workdir"
  apt-get "${PGDG_APT_OPTS[@]}" update >&2
  (
    cd "$workdir"
    apt-get "${PGDG_APT_OPTS[@]}" download "postgresql-client-${major}" libpq5 >&2
    apt-get download postgresql-client-common >&2
  )
}

detect_server_major() {
  rm -rf "$PROBE_ROOT" "$PROBE_WORK"
  mkdir -p "$PROBE_ROOT" "$PROBE_WORK"
  download_ubuntu_client_debs 16 "$PROBE_WORK"
  extract_debs "$PROBE_ROOT" "$PROBE_WORK"/*.deb
  wire_client_env "$PROBE_ROOT"
  local psql_bin
  psql_bin="$(find "$PROBE_ROOT" -name psql -type f | head -1)"
  if [ -z "$psql_bin" ]; then
    echo "bootstrap-pgclient: probe psql not found" >&2
    exit 1
  fi
  local major
  major="$("$psql_bin" "$DATABASE_URL" -tAc "SELECT current_setting('server_version_num')::int / 10000")"
  major="${major//[[:space:]]/}"
  if ! [[ "$major" =~ ^[0-9]+$ ]] || [ "$major" -le 0 ]; then
    echo "bootstrap-pgclient: unable to read server major from ${DATABASE_URL}" >&2
    exit 1
  fi
  echo "$major"
}

install_client_for_major() {
  local major=$1
  rm -rf "$ROOT" "$WORKDIR"
  mkdir -p "$ROOT" "$WORKDIR"

  if [ "$major" -le 16 ]; then
    download_ubuntu_client_debs 16 "$WORKDIR"
  else
    download_pgdg_client_debs "$major" "$WORKDIR"
  fi

  extract_debs "$ROOT" "$WORKDIR"/*.deb
  wire_client_env "$ROOT"

  if [ -n "${GITHUB_PATH:-}" ]; then
    echo "$PG_BIN_DIR" >> "$GITHUB_PATH"
  fi
  if [ -n "${GITHUB_ENV:-}" ]; then
    echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH}" >> "$GITHUB_ENV"
    echo "SOSMESH_PGCLIENT_ROOT=${ROOT}" >> "$GITHUB_ENV"
    echo "SOSMESH_PG_SERVER_MAJOR=${major}" >> "$GITHUB_ENV"
  fi

  echo "bootstrap-pgclient: server_major=${major} pg_dump=$("$PG_DUMP_BIN" --version)" >&2
  "$PG_DUMP_BIN" --version
  "$PG_RESTORE_BIN" --version
}

SERVER_MAJOR="$(detect_server_major)"
install_client_for_major "$SERVER_MAJOR"
