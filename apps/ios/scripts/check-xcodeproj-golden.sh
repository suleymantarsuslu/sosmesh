#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 scripts/generate-xcodeproj.py
cmp -s SOSMesh.xcodeproj/project.pbxproj scripts/golden-project.pbxproj
