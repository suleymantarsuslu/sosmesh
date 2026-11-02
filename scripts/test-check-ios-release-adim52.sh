#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHECK="$REPO_ROOT/apps/ios/scripts/check-release-adim52.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "=== check-release-adim52 mutation tests ==="

echo "Test 1: clean repo passes"
bash "$CHECK"

echo "Test 2: wrong UIBackgroundModes fails"
cp "$REPO_ROOT/apps/ios/SOSMesh/Info.plist" "$TMP/Info.plist.bak"
python3 - <<'PY' "$REPO_ROOT/apps/ios/SOSMesh/Info.plist"
import plistlib
from pathlib import Path
import sys
p = Path(sys.argv[1])
info = plistlib.loads(p.read_bytes())
info.setdefault("UIBackgroundModes", []).append("location")
p.write_bytes(plistlib.dumps(info))
PY
set +e
bash "$CHECK" >"$TMP/out.txt" 2>&1
code=$?
set -e
mv "$TMP/Info.plist.bak" "$REPO_ROOT/apps/ios/SOSMesh/Info.plist"
if [[ "$code" -eq 0 ]]; then
  echo "FAIL: check should reject location UIBackgroundMode"
  cat "$TMP/out.txt"
  exit 1
fi
grep -q 'UIBackgroundModes' "$TMP/out.txt" || {
  echo "FAIL: expected UIBackgroundModes error in output"
  cat "$TMP/out.txt"
  exit 1
}

echo "Test 3: hardcoded prod bundle id in ExportOptions template fails"
cp "$REPO_ROOT/apps/ios/scripts/ExportOptions.template.plist" "$TMP/ExportOptions.bak"
sed 's/__SOSMESH_BUNDLE_ID_IOS__/com.sosmesh.ios/g' "$TMP/ExportOptions.bak" > "$REPO_ROOT/apps/ios/scripts/ExportOptions.template.plist"
set +e
bash "$CHECK" >"$TMP/out2.txt" 2>&1
code2=$?
set -e
mv "$TMP/ExportOptions.bak" "$REPO_ROOT/apps/ios/scripts/ExportOptions.template.plist"
if [[ "$code2" -eq 0 ]]; then
  echo "FAIL: check should require __SOSMESH_BUNDLE_ID_IOS__ placeholder"
  cat "$TMP/out2.txt"
  exit 1
fi

echo "test-check-ios-release-adim52: OK (3 tests)"
exit 0
