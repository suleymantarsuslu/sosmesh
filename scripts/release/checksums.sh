#!/usr/bin/env bash
# SHA256 checksums for reproducible build artifacts (post pnpm -r build).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="$REPO_ROOT/docs/release"
SUM_FILE="$OUT_DIR/SHA256SUMS"

cd "$REPO_ROOT"

ARTIFACTS=(
  "packages/contracts/dist"
  "packages/transport/dist"
  "packages/ble-protocol/dist"
  "apps/api/dist"
)

missing=0
for path in "${ARTIFACTS[@]}"; do
  if [ ! -d "$path" ]; then
    echo "Missing build output directory: $path (run pnpm -r build first)"
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  exit 1
fi

mkdir -p "$OUT_DIR"
: > "$SUM_FILE"

while IFS= read -r -d '' file; do
  rel="${file#"$REPO_ROOT"/}"
  hash="$(sha256sum "$file" | awk '{print $1}')"
  printf '%s  %s\n' "$hash" "$rel" >> "$SUM_FILE"
done < <(find "${ARTIFACTS[@]}" -type f -print0 | sort -z)

if [ ! -s "$SUM_FILE" ]; then
  echo "No files hashed — empty SHA256SUMS"
  exit 1
fi

echo "Wrote $SUM_FILE ($(wc -l < "$SUM_FILE") files)"
