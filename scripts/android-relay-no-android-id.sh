#!/usr/bin/env bash
# Relay uplink must not read ANDROID_ID / Settings.Secure (install-scoped random relay id instead).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RELAY_MAIN="$ROOT/apps/android/feature-relay/src/main"

PATTERN='Settings\.Secure|ANDROID_ID'

if grep -RIn -E "$PATTERN" "$RELAY_MAIN"; then
  echo "Relay feature must not use Settings.Secure or ANDROID_ID:"
  exit 1
else
  grep_status=$?
  if [ "$grep_status" -ge 2 ]; then
    exit "$grep_status"
  fi
fi

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(process.cwd(), 'apps/android/feature-relay/src/main');
const needle = /Settings\.Secure|ANDROID_ID/;

function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.name.endsWith('.kt') && !name.name.endsWith('.java')) {
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    if (needle.test(text)) {
      console.error(`Relay feature must not use Settings.Secure or ANDROID_ID: ${full}`);
      process.exit(1);
    }
  }
}

walk(root);
console.log('android-relay-no-android-id: OK');
NODE
