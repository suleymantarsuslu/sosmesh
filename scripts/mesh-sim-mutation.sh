#!/usr/bin/env bash
# ADIM 11 mutation harness — temporarily breaks digest/TTL guards; targeted tests must fail; then revert.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RECEIVER="$REPO_ROOT/packages/ble-protocol/src/receiver.ts"
RELAY="$REPO_ROOT/tools/mesh-simulator/src/relay-mesh.ts"

cd "$REPO_ROOT"

backup() {
  cp "$RECEIVER" "$RECEIVER.mutation.bak"
  cp "$RELAY" "$RELAY.mutation.bak"
}

restore() {
  if [ -f "$RECEIVER.mutation.bak" ]; then
    mv "$RECEIVER.mutation.bak" "$RECEIVER"
  fi
  if [ -f "$RELAY.mutation.bak" ]; then
    mv "$RELAY.mutation.bak" "$RELAY"
  fi
}

trap restore EXIT

run_digest_test() {
  pnpm --filter @sosmesh/ble-protocol build
  pnpm --filter @sosmesh/mesh-simulator build
  pnpm --filter @sosmesh/chaos-tests exec vitest run -t chaos_mandatory_digest_invalid_never_completed --reporter=verbose
}

run_ttl_test() {
  pnpm --filter @sosmesh/mesh-simulator build
  pnpm --filter @sosmesh/chaos-tests exec vitest run -t chaos_negative_ttl_exceeded_drops_before_final_delivery --reporter=verbose
}

backup

echo "=== Mutation (a): disable digest verification in receiver ==="
python3 - <<'PY'
from pathlib import Path
p = Path("packages/ble-protocol/src/receiver.ts")
text = p.read_text()
text = text.replace(
    "if (!verifyDigest(assembled, digest)) {",
    "if (false && !verifyDigest(assembled, digest)) {",
)
p.write_text(text)
PY

set +e
run_digest_test
EXIT_A=$?
set -e
echo "Mutation (a) targeted test exit: $EXIT_A"
if [ "$EXIT_A" -eq 0 ]; then
  echo "❌ Expected chaos_mandatory_digest_invalid_never_completed to fail under mutation (a)"
  restore
  exit 1
fi
echo "✅ Mutation (a) broke digest guard as expected"

restore
backup

echo "=== Mutation (b): disable TTL decrement in relay mesh ==="
python3 - <<'PY'
from pathlib import Path
p = Path("tools/mesh-simulator/src/relay-mesh.ts")
text = p.read_text()
text = text.replace(
    "let nextTtl = wrappedAtB.ttl - 1;",
    "let nextTtl = wrappedAtB.ttl; /* mutation */",
)
p.write_text(text)
PY

set +e
run_ttl_test
EXIT_B=$?
set -e
echo "Mutation (b) targeted test exit: $EXIT_B"
if [ "$EXIT_B" -eq 0 ]; then
  echo "❌ Expected chaos_negative_ttl_exceeded_drops_before_final_delivery to fail under mutation (b)"
  restore
  exit 1
fi
echo "✅ Mutation (b) broke TTL decrement as expected"

restore
echo "=== Mutation harness complete — sources restored; EXIT=0 ==="
exit 0
