#!/usr/bin/env bash
# SOSMesh Quality Gate Verification
# Runs all quality checks and generates JUnit/JSON reports
# Exit 0 = all checks passed, exit 1 = at least one check failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORTS_DIR="$REPO_ROOT/reports"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== SOSMesh Quality Gate Verification ==="
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Prepare reports directory
mkdir -p "$REPORTS_DIR"
rm -rf "$REPORTS_DIR"/*

# Track failures
FAILED_CHECKS=()
TOTAL_CHECKS=0

check_exit() {
  local name=$1
  local exit_code=$2
  local log_file="$REPORTS_DIR/${3:-$name}.log"
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  
  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ $name PASSED${NC}"
  else
    echo -e "${RED}❌ $name FAILED (exit $exit_code)${NC}"
    FAILED_CHECKS+=("$name")
    if [ -f "$log_file" ]; then
      echo -e "${YELLOW}Last 80 lines of $log_file:${NC}"
      tail -80 "$log_file"
    fi
  fi
  echo ""
}

cd "$REPO_ROOT"

# 1. Install dependencies
echo "1/18: pnpm install --frozen-lockfile"
if pnpm install --frozen-lockfile > "$REPORTS_DIR/install.log" 2>&1; then
  check_exit "install" 0
else
  EXIT_CODE=$?
  check_exit "install" $EXIT_CODE
fi

# 2. Build all packages
echo "2/18: pnpm -r build"
if pnpm -r build > "$REPORTS_DIR/build.log" 2>&1; then
  check_exit "build" 0
else
  EXIT_CODE=$?
  check_exit "build" $EXIT_CODE
fi

# 3. Lint
echo "3/18: pnpm lint"
if pnpm lint > "$REPORTS_DIR/lint.log" 2>&1; then
  check_exit "lint" 0
else
  EXIT_CODE=$?
  check_exit "lint" $EXIT_CODE
fi

# 4. TypeCheck all TS packages
echo "4/18: TypeScript typecheck"
TYPECHECK_EXIT=0
for PKG in apps/api apps/web packages/contracts; do
  if [ -f "$PKG/tsconfig.json" ]; then
    echo "  Checking $PKG..."
    if ! (cd "$PKG" && npx tsc --noEmit > "$REPORTS_DIR/typecheck-$(basename $PKG).log" 2>&1); then
      TYPECHECK_EXIT=1
      echo "  ❌ $PKG typecheck failed"
    fi
  fi
done
check_exit "typecheck" $TYPECHECK_EXIT

# 5. Unit tests
echo "5/18: pnpm test"
if pnpm test > "$REPORTS_DIR/test.log" 2>&1; then
  check_exit "test" 0
else
  EXIT_CODE=$?
  check_exit "test" $EXIT_CODE
fi

# 6. Smoke test
echo "6/18: bash scripts/smoke.sh"
if bash "$SCRIPT_DIR/smoke.sh" > "$REPORTS_DIR/smoke.log" 2>&1; then
  check_exit "smoke" 0
else
  EXIT_CODE=$?
  check_exit "smoke" $EXIT_CODE
fi

# 7. Web a11y test
echo "7/18: pnpm test:a11y:web"
# Ensure port 3000 is free before starting
PORT_CHECK_FAILED=false
if lsof -ti:3000 >/dev/null 2>&1; then
  echo -e "${YELLOW}Port 3000 is still in use before a11y-web test. Cleaning up...${NC}"
  lsof -ti:3000 | xargs -r kill -9 2>/dev/null || true
  sleep 2
  if lsof -ti:3000 >/dev/null 2>&1; then
    echo -e "${RED}❌ Failed to free port 3000${NC}" | tee "$REPORTS_DIR/a11y-web.log"
    PORT_CHECK_FAILED=true
  fi
fi

if [ "$PORT_CHECK_FAILED" = true ]; then
  check_exit "a11y-web" 1
elif pnpm test:a11y:web > "$REPORTS_DIR/a11y-web.log" 2>&1; then
  check_exit "a11y-web" 0
else
  EXIT_CODE=$?
  check_exit "a11y-web" $EXIT_CODE
fi

# 8. UX Playwright suite
echo "8/18: npx playwright test"
if npx playwright test > "$REPORTS_DIR/playwright-ux.log" 2>&1; then
  check_exit "playwright-ux" 0
else
  EXIT_CODE=$?
  check_exit "playwright-ux" $EXIT_CODE
fi

# 9. UX forbidden copy
echo "9/18: node scripts/ux-forbidden-copy.js"
if node "$SCRIPT_DIR/ux-forbidden-copy.js" > "$REPORTS_DIR/ux-forbidden-copy.log" 2>&1; then
  check_exit "ux-forbidden-copy" 0
else
  EXIT_CODE=$?
  check_exit "ux-forbidden-copy" $EXIT_CODE
fi

# 10. UX master labels
echo "10/18: node scripts/ux-check-master-labels.js"
if node "$SCRIPT_DIR/ux-check-master-labels.js" > "$REPORTS_DIR/ux-master-labels.log" 2>&1; then
  check_exit "ux-master-labels" 0
else
  EXIT_CODE=$?
  check_exit "ux-master-labels" $EXIT_CODE
fi

# 11. UX i18n keys
echo "11/18: node scripts/ux-check-i18n-keys.js"
if node "$SCRIPT_DIR/ux-check-i18n-keys.js" > "$REPORTS_DIR/ux-i18n-keys.log" 2>&1; then
  check_exit "ux-i18n-keys" 0
else
  EXIT_CODE=$?
  check_exit "ux-i18n-keys" $EXIT_CODE
fi

# 12. UX contrast check
echo "12/18: node scripts/ux-check-contrast.js"
if node "$SCRIPT_DIR/ux-check-contrast.js" > "$REPORTS_DIR/ux-contrast.log" 2>&1; then
  check_exit "ux-contrast" 0
else
  EXIT_CODE=$?
  check_exit "ux-contrast" $EXIT_CODE
fi

# 13. UX screen states
echo "13/18: node scripts/ux-check-screen-states.js"
if node "$SCRIPT_DIR/ux-check-screen-states.js" > "$REPORTS_DIR/ux-screen-states.log" 2>&1; then
  check_exit "ux-screen-states" 0
else
  EXIT_CODE=$?
  check_exit "ux-screen-states" $EXIT_CODE
fi

# 14. Secret scan
echo "14/18: bash scripts/secret-scan.sh"
if bash "$SCRIPT_DIR/secret-scan.sh" > "$REPORTS_DIR/secret-scan.log" 2>&1; then
  check_exit "secret-scan" 0
else
  EXIT_CODE=$?
  check_exit "secret-scan" $EXIT_CODE
fi

# 15. Secret scan test
echo "15/18: bash scripts/test-secret-scan.sh"
if bash "$SCRIPT_DIR/test-secret-scan.sh" > "$REPORTS_DIR/test-secret-scan.log" 2>&1; then
  check_exit "test-secret-scan" 0
else
  EXIT_CODE=$?
  check_exit "test-secret-scan" $EXIT_CODE
fi

# 16. Dependency cycles
echo "16/18: bash scripts/check-dependency-cycles.sh"
if bash "$SCRIPT_DIR/check-dependency-cycles.sh" > "$REPORTS_DIR/dependency-cycles.log" 2>&1; then
  check_exit "dependency-cycles" 0
else
  EXIT_CODE=$?
  check_exit "dependency-cycles" $EXIT_CODE
fi

# 17. Compose check
echo "17/18: node scripts/check-compose.js"
if node "$SCRIPT_DIR/check-compose.js" > "$REPORTS_DIR/check-compose.log" 2>&1; then
  check_exit "check-compose" 0
else
  EXIT_CODE=$?
  check_exit "check-compose" $EXIT_CODE
fi

# 18. Check for skipped tests
echo "18/21: node scripts/check-no-skips.js"
if node "$SCRIPT_DIR/check-no-skips.js" > "$REPORTS_DIR/check-no-skips.log" 2>&1; then
  check_exit "check-no-skips" 0
else
  EXIT_CODE=$?
  check_exit "check-no-skips" $EXIT_CODE
fi

# 19. Check golden vector byte-equality
echo "19/21: Golden vector byte-equality"
MASTER_GOLDEN="packages/contracts/crypto-test-vectors/golden-001.json"
KOTLIN_GOLDEN="packages/contracts-kotlin/src/test/resources/golden-001.json"
SWIFT_GOLDEN="packages/contracts-swift/Tests/SOSMeshContractsTests/Resources/golden-001.json"
if cmp -s "$MASTER_GOLDEN" "$KOTLIN_GOLDEN" && cmp -s "$MASTER_GOLDEN" "$SWIFT_GOLDEN"; then
  check_exit "golden-vector-equality" 0
else
  check_exit "golden-vector-equality" 1
fi

# 20. Mesh simulator golden + chaos lab
echo "20/21: bash scripts/mesh-sim-golden.sh"
if bash "$SCRIPT_DIR/mesh-sim-golden.sh" > "$REPORTS_DIR/mesh-sim-golden.log" 2>&1; then
  check_exit "mesh-sim-golden" 0
else
  EXIT_CODE=$?
  check_exit "mesh-sim-golden" $EXIT_CODE
fi

# 21. OpenAPI spec freshness
echo "21/25: node scripts/check-openapi.js"
if node "$SCRIPT_DIR/check-openapi.js" > "$REPORTS_DIR/check-openapi.log" 2>&1; then
  check_exit "check-openapi" 0
else
  EXIT_CODE=$?
  check_exit "check-openapi" $EXIT_CODE
fi

# 22. Android SOS privacy (no Log/Timber in SOS UI paths)
echo "22/25: bash scripts/android-sos-privacy-log.sh"
if bash "$SCRIPT_DIR/android-sos-privacy-log.sh" > "$REPORTS_DIR/android-sos-privacy.log" 2>&1; then
  check_exit "android-sos-privacy-log" 0
else
  EXIT_CODE=$?
  check_exit "android-sos-privacy-log" $EXIT_CODE
fi

# 23. Release build must not bundle dev-test SOS crypto
echo "23/25: bash scripts/android-release-no-dev-crypto.sh"
if bash "$SCRIPT_DIR/android-release-no-dev-crypto.sh" > "$REPORTS_DIR/android-release-no-dev-crypto.log" 2>&1; then
  check_exit "android-release-no-dev-crypto" 0
else
  EXIT_CODE=$?
  check_exit "android-release-no-dev-crypto" $EXIT_CODE
fi

# 24. Relay uplink must not derive relay id from ANDROID_ID
echo "24/25: bash scripts/android-relay-no-android-id.sh"
if bash "$SCRIPT_DIR/android-relay-no-android-id.sh" > "$REPORTS_DIR/android-relay-no-android-id.log" 2>&1; then
  check_exit "android-relay-no-android-id" 0
else
  EXIT_CODE=$?
  check_exit "android-relay-no-android-id" $EXIT_CODE
fi

# Summary
echo "============================================"
echo "Finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Total checks: $TOTAL_CHECKS"
echo "Failed: ${#FAILED_CHECKS[@]}"

if [ ${#FAILED_CHECKS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
  exit 0
else
  echo -e "${RED}❌ FAILED CHECKS:${NC}"
  for check in "${FAILED_CHECKS[@]}"; do
    echo "  - $check"
  done
  exit 1
fi
