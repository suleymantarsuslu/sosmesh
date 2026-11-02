#!/usr/bin/env bash
# Back-compat wrapper — use bootstrap-pgclient.sh (server-major aware).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/bootstrap-pgclient.sh" "$@"
