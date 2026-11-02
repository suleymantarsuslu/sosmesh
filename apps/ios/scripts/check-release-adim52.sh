#!/usr/bin/env bash
# ADIM 52 release gate: privacy manifests, background modes, export template, lproj paths in golden pbxproj.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "check-release-adim52: FAIL: $*" >&2
  exit 1
}

# archive-export.sh must fail closed (no error swallowing).
head -n 5 scripts/archive-export.sh | grep -q 'set -euo pipefail' \
  || fail "archive-export.sh must use set -euo pipefail"

grep -q '__SOSMESH_BUNDLE_ID_IOS__' scripts/ExportOptions.template.plist \
  || fail "ExportOptions.template.plist missing __SOSMESH_BUNDLE_ID_IOS__ placeholder"
grep -q '__SOSMESH_BUNDLE_ID_WATCH__' scripts/ExportOptions.template.plist \
  || fail "ExportOptions.template.plist missing watch bundle placeholder"
grep -q '__SOSMESH_BUNDLE_ID_WIDGETS__' scripts/ExportOptions.template.plist \
  || fail "ExportOptions.template.plist missing widgets bundle placeholder"

for flavor in demo staging prod; do
  case "$flavor" in
    demo) xcconfig="Config/Release-Demo.xcconfig" ;;
    staging) xcconfig="Config/Release-Staging.xcconfig" ;;
    prod) xcconfig="Config/Release-Prod.xcconfig" ;;
  esac
  [[ -f "$xcconfig" ]] || fail "missing $xcconfig"
  ios_id="$(grep -E '^[[:space:]]*PRODUCT_BUNDLE_IDENTIFIER[[:space:]]*=' "$xcconfig" | tail -n 1 | sed 's/.*=[[:space:]]*//')"
  watch_id="$(grep -E '^[[:space:]]*SOSMESH_BUNDLE_ID_WATCH[[:space:]]*=' "$xcconfig" | tail -n 1 | sed 's/.*=[[:space:]]*//')"
  widgets_id="$(grep -E '^[[:space:]]*SOSMESH_BUNDLE_ID_WIDGETS[[:space:]]*=' "$xcconfig" | tail -n 1 | sed 's/.*=[[:space:]]*//')"
  [[ -n "$ios_id" && -n "$watch_id" && -n "$widgets_id" ]] \
    || fail "$xcconfig must define iOS/watch/widgets bundle IDs"
  if [[ "$flavor" == "prod" ]]; then
    [[ "$ios_id" == "com.sosmesh.ios" ]] || fail "prod iOS bundle id mismatch"
  else
    [[ "$ios_id" == *".$flavor" ]] || fail "$xcconfig PRODUCT_BUNDLE_IDENTIFIER should include .$flavor suffix"
  fi
done

python3 - <<'PY' "$ROOT/SOSMesh/Info.plist" || exit 1
import plistlib
import sys
from pathlib import Path

info_path = Path(sys.argv[1])
with info_path.open("rb") as f:
    info = plistlib.load(f)
modes = info.get("UIBackgroundModes") or []
allowed = {"bluetooth-central", "bluetooth-peripheral"}
extra = set(modes) - allowed
if extra:
    raise SystemExit(f"UIBackgroundModes must only be BLE modes; found extra: {sorted(extra)}")
if not modes:
    raise SystemExit("UIBackgroundModes must include bluetooth-central and bluetooth-peripheral")
PY

for manifest in \
  SOSMesh/PrivacyInfo.xcprivacy \
  ../watchos/SOSMeshWatch/PrivacyInfo.xcprivacy \
  ../watchos/SOSMeshWatchWidgets/PrivacyInfo.xcprivacy; do
  path="$ROOT/$manifest"
  [[ -f "$path" ]] || fail "missing privacy manifest $manifest"
  grep -q '<key>NSPrivacyTracking</key>' "$path" || fail "$manifest missing NSPrivacyTracking"
  grep -A1 'NSPrivacyTracking' "$path" | grep -q '<false/>' \
    || fail "$manifest must set NSPrivacyTracking false"
done

for strings_file in SOSMesh/en.lproj/InfoPlist.strings SOSMesh/tr.lproj/InfoPlist.strings; do
  [[ -f "$ROOT/$strings_file" ]] || fail "missing $strings_file"
  grep -q 'NSBluetoothAlwaysUsageDescription' "$ROOT/$strings_file" \
    || fail "$strings_file must localize Bluetooth usage"
  grep -q 'NSLocationWhenInUseUsageDescription' "$ROOT/$strings_file" \
    || fail "$strings_file must localize location usage (optional flow)"
done

bash scripts/check-xcodeproj-golden.sh

# Localized strings must reference .lproj paths in generated golden (Info.plist localization).
grep -q 'SOSMesh/tr.lproj/InfoPlist.strings' scripts/golden-project.pbxproj \
  || fail "golden pbxproj must reference tr.lproj InfoPlist.strings with SOURCE_ROOT path"
grep -q 'SOSMesh/en.lproj/InfoPlist.strings' scripts/golden-project.pbxproj \
  || fail "golden pbxproj must reference en.lproj InfoPlist.strings with SOURCE_ROOT path"

# Simulated export plist substitution (Linux-safe; no macOS archive).
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export SOSMESH_RELEASE_FLAVOR=demo
export SOSMESH_APPLE_TEAM_ID=TEAMID0123
export SOSMESH_IOS_PROFILE_NAME="Demo iOS"
export SOSMESH_WATCH_PROFILE_NAME="Demo Watch"
export SOSMESH_WIDGET_PROFILE_NAME="Demo Widgets"
XCCONFIG="Config/Release-Demo.xcconfig"
BUNDLE_ID_IOS="$(grep -E '^[[:space:]]*PRODUCT_BUNDLE_IDENTIFIER[[:space:]]*=' "$XCCONFIG" | tail -n 1 | sed 's/.*=[[:space:]]*//')"
BUNDLE_ID_WATCH="$(grep -E '^[[:space:]]*SOSMESH_BUNDLE_ID_WATCH[[:space:]]*=' "$XCCONFIG" | tail -n 1 | sed 's/.*=[[:space:]]*//')"
BUNDLE_ID_WIDGETS="$(grep -E '^[[:space:]]*SOSMESH_BUNDLE_ID_WIDGETS[[:space:]]*=' "$XCCONFIG" | tail -n 1 | sed 's/.*=[[:space:]]*//')"
sed -e "s/__SOSMESH_APPLE_TEAM_ID__/TEAMID0123/g" \
  -e "s/__SOSMESH_BUNDLE_ID_IOS__/${BUNDLE_ID_IOS}/g" \
  -e "s/__SOSMESH_BUNDLE_ID_WATCH__/${BUNDLE_ID_WATCH}/g" \
  -e "s/__SOSMESH_BUNDLE_ID_WIDGETS__/${BUNDLE_ID_WIDGETS}/g" \
  -e "s/__SOSMESH_IOS_PROFILE_NAME__/Demo iOS/g" \
  -e "s/__SOSMESH_WATCH_PROFILE_NAME__/Demo Watch/g" \
  -e "s/__SOSMESH_WIDGET_PROFILE_NAME__/Demo Widgets/g" \
  scripts/ExportOptions.template.plist > "$TMP/ExportOptions-demo.plist"
grep -q "<key>${BUNDLE_ID_IOS}</key>" "$TMP/ExportOptions-demo.plist" \
  || fail "export substitution must embed demo iOS bundle id as provisioning key"
grep -q 'com.sosmesh.ios.demo.watch.widgets' "$TMP/ExportOptions-demo.plist" \
  || fail "export substitution must embed demo widgets bundle id"

echo "check-release-adim52: OK"
exit 0
