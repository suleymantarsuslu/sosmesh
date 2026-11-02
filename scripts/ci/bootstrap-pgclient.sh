#!/usr/bin/env bash
# Bootstrap pg_dump/pg_restore matching SOSMESH_CI_DATABASE_URL server major (no sudo).
set -euo pipefail

RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"
ROOT="${SOSMESH_PGCLIENT_ROOT:-${RUNNER_TEMP}/pgclient}"
WORKDIR="${SOSMESH_PGCLIENT_WORK:-${RUNNER_TEMP}/pgclient-dl}"

DATABASE_URL="${SOSMESH_CI_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DATABASE_URL" ]; then
  echo "bootstrap-pgclient: SOSMESH_CI_DATABASE_URL or DATABASE_URL is required" >&2
  exit 1
fi

parse_tool_major() {
  local tool=$1
  local line
  line="$("$tool" --version 2>&1 | head -1)"
  if [[ "$line" =~ ([0-9]+)\. ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "0"
  fi
}

detect_server_major() {
  if ! command -v psql >/dev/null 2>&1; then
    echo "bootstrap-pgclient: psql not found; GitHub/ubuntu runners usually ship postgresql-client" >&2
    exit 1
  fi
  local major
  major="$(psql "$DATABASE_URL" -tAc "SELECT current_setting('server_version_num')::int / 10000")"
  major="${major//[[:space:]]/}"
  if ! [[ "$major" =~ ^[0-9]+$ ]] || [ "$major" -le 0 ]; then
    echo "bootstrap-pgclient: unable to read server major from DATABASE_URL" >&2
    exit 1
  fi
  echo "$major"
}

extract_debs() {
  local dest=$1
  shift
  if [ "$#" -eq 0 ]; then
    echo "bootstrap-pgclient: no .deb packages to extract" >&2
    exit 1
  fi
  mkdir -p "$dest"
  for deb in "$@"; do
    if [ ! -f "$deb" ]; then
      echo "bootstrap-pgclient: missing deb archive: $deb" >&2
      exit 1
    fi
    dpkg-deb -x "$deb" "$dest"
  done
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

publish_github_env() {
  local major=$1
  if [ -n "${GITHUB_PATH:-}" ]; then
    echo "$PG_BIN_DIR" >> "$GITHUB_PATH"
  fi
  if [ -n "${GITHUB_ENV:-}" ]; then
    echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH}" >> "$GITHUB_ENV"
    echo "SOSMESH_PGCLIENT_ROOT=${ROOT}" >> "$GITHUB_ENV"
    echo "SOSMESH_PG_SERVER_MAJOR=${major}" >> "$GITHUB_ENV"
    echo "SOSMESH_PG_DUMP_PATH=${PG_DUMP_BIN}" >> "$GITHUB_ENV"
    echo "SOSMESH_PG_RESTORE_PATH=${PG_RESTORE_BIN}" >> "$GITHUB_ENV"
  fi
}

try_use_installed_client() {
  local server_major=$1
  if ! command -v pg_dump >/dev/null 2>&1; then
    return 1
  fi
  if ! command -v pg_restore >/dev/null 2>&1; then
    return 1
  fi
  PG_DUMP_BIN="$(command -v pg_dump)"
  PG_RESTORE_BIN="$(command -v pg_restore)"
  PG_BIN_DIR="$(dirname "$PG_DUMP_BIN")"
  local dump_major restore_major
  dump_major="$(parse_tool_major "$PG_DUMP_BIN")"
  restore_major="$(parse_tool_major "$PG_RESTORE_BIN")"
  if [ "$dump_major" -lt "$server_major" ] || [ "$restore_major" -lt "$server_major" ]; then
    echo "bootstrap-pgclient: system client dump=${dump_major} restore=${restore_major} < server=${server_major}; will download" >&2
    return 1
  fi
  export PATH="$PG_BIN_DIR:$PATH"
  publish_github_env "$server_major"
  echo "bootstrap-pgclient: using installed pg_dump (major ${dump_major}) for server major ${server_major}" >&2
  "$PG_DUMP_BIN" --version
  "$PG_RESTORE_BIN" --version
  return 0
}

download_ubuntu_client_debs() {
  local major=$1
  local workdir=$2
  mkdir -p "$workdir"
  (
    cd "$workdir"
    apt-get download "postgresql-client-${major}" postgresql-client-common libpq5
  )
}

setup_pgdg_apt() {
  PGDG_APT_ROOT="${RUNNER_TEMP}/pgdg-apt"
  mkdir -p "$PGDG_APT_ROOT/lists/partial" "$PGDG_APT_ROOT/cache/archives"
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
  apt-get "${PGDG_APT_OPTS[@]}" update
  (
    cd "$workdir"
    apt-get "${PGDG_APT_OPTS[@]}" download "postgresql-client-${major}" libpq5
    apt-get download postgresql-client-common
  )
}

install_client_from_debs() {
  local major=$1
  rm -rf "$ROOT" "$WORKDIR"
  mkdir -p "$ROOT" "$WORKDIR"

  if [ "$major" -le 16 ]; then
    if ! download_ubuntu_client_debs "$major" "$WORKDIR"; then
      echo "bootstrap-pgclient: ubuntu archive download failed for postgresql-client-${major}" >&2
      exit 1
    fi
  else
    if ! download_pgdg_client_debs "$major" "$WORKDIR"; then
      echo "bootstrap-pgclient: PGDG download failed for postgresql-client-${major}" >&2
      exit 1
    fi
  fi

  shopt -s nullglob
  local debs=("$WORKDIR"/*.deb)
  shopt -u nullglob
  if [ "${#debs[@]}" -eq 0 ]; then
    echo "bootstrap-pgclient: apt download produced no .deb files under ${WORKDIR}" >&2
    exit 1
  fi

  extract_debs "$ROOT" "${debs[@]}"
  wire_client_env "$ROOT"
  publish_github_env "$major"

  echo "bootstrap-pgclient: server_major=${major} pg_dump=$("$PG_DUMP_BIN" --version)" >&2
  "$PG_DUMP_BIN" --version
  "$PG_RESTORE_BIN" --version
}

SERVER_MAJOR="${SOSMESH_PG_SERVER_MAJOR:-}"
if [ -z "$SERVER_MAJOR" ]; then
  SERVER_MAJOR="$(detect_server_major)"
fi
if ! [[ "$SERVER_MAJOR" =~ ^[0-9]+$ ]] || [ "$SERVER_MAJOR" -le 0 ]; then
  echo "bootstrap-pgclient: invalid SOSMESH_PG_SERVER_MAJOR=${SERVER_MAJOR}" >&2
  exit 1
fi
if try_use_installed_client "$SERVER_MAJOR"; then
  exit 0
fi
install_client_from_debs "$SERVER_MAJOR"
