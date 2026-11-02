#!/usr/bin/env bash
# ADIM 52 — Archive + IPA export for TestFlight eligibility (macOS + Xcode only).
# No signing secrets in repo: set env vars documented in docs/release/ios.md
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: xcodebuild archive requires macOS with Xcode. This Linux/CI agent cannot produce signed IPAs." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FLAVOR="${SOSMESH_RELEASE_FLAVOR:-prod}"
case "$FLAVOR" in
  demo) XCCONFIG="Config/Release-Demo.xcconfig" ;;
  staging) XCCONFIG="Config/Release-Staging.xcconfig" ;;
  prod) XCCONFIG="Config/Release-Prod.xcconfig" ;;
  *)
    echo "Unknown SOSMESH_RELEASE_FLAVOR=$FLAVOR (demo|staging|prod)" >&2
    exit 1
    ;;
esac

: "${SOSMESH_APPLE_TEAM_ID:?Set SOSMESH_APPLE_TEAM_ID (10-char Team ID, not committed)}"
: "${SOSMESH_CODE_SIGN_IDENTITY:=Apple Distribution}"
: "${SOSMESH_IOS_PROFILE_NAME:?Set SOSMESH_IOS_PROFILE_NAME (provisioning profile name for iOS app)}"
: "${SOSMESH_WATCH_PROFILE_NAME:?Set SOSMESH_WATCH_PROFILE_NAME}"
: "${SOSMESH_WIDGET_PROFILE_NAME:?Set SOSMESH_WIDGET_PROFILE_NAME}"

ARCHIVE_PATH="${SOSMESH_ARCHIVE_PATH:-$ROOT/build/SOSMesh-${FLAVOR}.xcarchive}"
EXPORT_PATH="${SOSMESH_EXPORT_PATH:-$ROOT/build/export-${FLAVOR}}"
EXPORT_OPTS="$ROOT/build/ExportOptions-${FLAVOR}.plist"
mkdir -p "$(dirname "$ARCHIVE_PATH")" "$EXPORT_PATH" "$(dirname "$EXPORT_OPTS")"

python3 scripts/generate-xcodeproj.py
cmp -s SOSMesh.xcodeproj/project.pbxproj scripts/golden-project.pbxproj

sed -e "s/__SOSMESH_APPLE_TEAM_ID__/${SOSMESH_APPLE_TEAM_ID}/g" \
  -e "s/__SOSMESH_IOS_PROFILE_NAME__/${SOSMESH_IOS_PROFILE_NAME}/g" \
  -e "s/__SOSMESH_WATCH_PROFILE_NAME__/${SOSMESH_WATCH_PROFILE_NAME}/g" \
  -e "s/__SOSMESH_WIDGET_PROFILE_NAME__/${SOSMESH_WIDGET_PROFILE_NAME}/g" \
  scripts/ExportOptions.template.plist > "$EXPORT_OPTS"

echo "Archiving SOSMesh-iOS (flavor=$FLAVOR, xcconfig=$XCCONFIG)…"
xcodebuild archive \
  -project SOSMesh.xcodeproj \
  -scheme SOSMesh-iOS \
  -configuration Release \
  -xcconfig "$XCCONFIG" \
  -archivePath "$ARCHIVE_PATH" \
  CODE_SIGNING_ALLOWED=YES \
  CODE_SIGNING_REQUIRED=YES \
  DEVELOPMENT_TEAM="$SOSMESH_APPLE_TEAM_ID" \
  CODE_SIGN_IDENTITY="$SOSMESH_CODE_SIGN_IDENTITY"

echo "Exporting IPA…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTS"

echo "Done. Archive: $ARCHIVE_PATH"
echo "Export dir: $EXPORT_PATH"
echo "TestFlight upload: BLOCKED_APPROVAL — run Transporter or xcrun altool only after user approval (docs/release/ios.md)."
