#!/usr/bin/env bash
set -euo pipefail

# Test check-no-skips.js with positive and negative cases

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=== check-no-skips.js Test Suite ==="
echo ""

# Test 1: No skips (positive)
echo "Test 1: Clean test file (no skips)"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"
git init -q
cat > test.spec.js << 'EOF'
test('should pass', () => {
  expect(true).toBe(true);
});

it('should also pass', () => {
  expect(1 + 1).toBe(2);
});
EOF
git add test.spec.js

if node "$SCRIPT_DIR/check-no-skips.js" > /dev/null 2>&1; then
  echo "  ✅ Clean file passes"
else
  echo "  ❌ Clean file should pass"
  exit 1
fi

# Test 2: test.skip (negative)
echo "Test 2: test.skip detected"
cat > test.spec.js << 'EOF'
test.skip('should be skipped', () => {
  expect(true).toBe(true);
});
EOF
git add test.spec.js

if node "$SCRIPT_DIR/check-no-skips.js" > /dev/null 2>&1; then
  echo "  ❌ test.skip should be detected"
  exit 1
else
  echo "  ✅ test.skip detected"
fi

# Test 3: it.only (negative)
echo "Test 3: it.only detected"
cat > test.spec.js << 'EOF'
it.only('focused test', () => {
  expect(true).toBe(true);
});
EOF
git add test.spec.js

if node "$SCRIPT_DIR/check-no-skips.js" > /dev/null 2>&1; then
  echo "  ❌ it.only should be detected"
  exit 1
else
  echo "  ✅ it.only detected"
fi

# Test 4: xit (negative)
echo "Test 4: xit detected"
cat > test.spec.js << 'EOF'
xit('excluded test', () => {
  expect(true).toBe(true);
});
EOF
git add test.spec.js

if node "$SCRIPT_DIR/check-no-skips.js" > /dev/null 2>&1; then
  echo "  ❌ xit should be detected"
  exit 1
else
  echo "  ✅ xit detected"
fi

# Test 5: describe.only (negative)
echo "Test 5: describe.only detected"
cat > test.spec.js << 'EOF'
describe.only('focused suite', () => {
  it('test', () => {
    expect(true).toBe(true);
  });
});
EOF
git add test.spec.js

if node "$SCRIPT_DIR/check-no-skips.js" > /dev/null 2>&1; then
  echo "  ❌ describe.only should be detected"
  exit 1
else
  echo "  ✅ describe.only detected"
fi

echo ""
echo "✅ All check-no-skips.js tests passed"
