#!/usr/bin/env bash
# Reject load tests against non-local hosts (prod/staging must never be hit from k6 scripts).
set -euo pipefail

url="${1:-}"
if [[ -z "$url" ]]; then
  echo "Usage: assert-local-base-url.sh <BASE_URL>" >&2
  exit 1
fi

host="$(
  node -e "
const u = new URL(process.argv[1]);
process.stdout.write(u.hostname);
" "$url"
)"

case "$host" in
  127.0.0.1 | localhost | ::1)
    exit 0
    ;;
  *)
    echo "BASE_URL must target localhost only (got host: $host)" >&2
    exit 1
    ;;
esac
