# SOSMesh Quality Gates

This document defines the quality gates and required checks for each milestone (ADIM).

---

## Overview

Quality gates prevent progression to the next milestone without passing all required checks. Each ADIM has specific verification requirements that must be met before marking it as PASS.

**Key Principle:** Sahte/skip test başarı sayılmıyor (Skipped or fake tests do not count as passing).

---

## Gate Enforcement

### Automated Verification

All checks run via `scripts/verify.sh`:

```bash
bash scripts/verify.sh
```

Exit code:
- `0` = All checks passed
- `1` = At least one check failed

### Reports

- JUnit/JSON reports: `reports/`
- Playwright HTML: `playwright-report/`
- Coverage: `coverage/`

---

## ADIM-Specific Gates

### ADIM 01: Prototip (UX)
**Status:** PASS

**Required Checks:**
- ✅ HTML/CSS validation
- ✅ A11y (axe) - 0 critical violations
- ✅ Forbidden copy check
- ✅ Contrast ratios (WCAG 2.1 AA)
- ✅ Mobile viewport (390x844, no horizontal overflow at 200% zoom)
- ✅ Dark mode support

**Verification:**
```bash
npx playwright test tests/ux/standard.spec.js
npx playwright test tests/ux/watch.spec.js
node scripts/ux-check-contrast.js
node scripts/ux-forbidden-copy.js
```

---

### ADIM 02: ADR & İçerik
**Status:** PASS

**Required Checks:**
- ✅ ADR structure (template compliance)
- ✅ i18n key parity (TR ↔ EN)
- ✅ Master label consistency
- ✅ Screen state matrix coverage

**Verification:**
```bash
node scripts/ux-check-i18n-keys.js
node scripts/ux-check-master-labels.js
node scripts/ux-check-screen-states.js
```

---

### ADIM 03: Test Strateji
**Status:** PASS

**Required Checks:**
- ✅ Test strategy document exists
- ✅ Gherkin scenario count validation
- ✅ QA checkpoint definitions

**Verification:**
```bash
node scripts/count-scenarios.js docs/tests/m0-acceptance.feature
```

---

### ADIM 04: Standartlar
**Status:** PASS

**Required Checks:**
- ✅ EditorConfig applied
- ✅ ESLint passes (0 errors)
- ✅ Prettier formatting
- ✅ Git hooks installed (Husky)
- ✅ Commit message convention

**Verification:**
```bash
pnpm lint
pnpm format:check
```

---

### ADIM 05: Monorepo & Dev Environment
**Status:** PASS (commit: 0bbc5a4)

**Required Checks:**
1. ✅ pnpm install --frozen-lockfile (no modifications)
2. ✅ pnpm -r build (all packages build successfully)
3. ✅ pnpm lint (0 errors, scripts/tests not ignored)
4. ✅ TypeScript typecheck (tsc --noEmit, all TS packages)
5. ✅ pnpm test (unit tests, no skips)
6. ✅ bash scripts/smoke.sh (API + Web endpoints reachable)
7. ✅ pnpm test:a11y:web (Next.js a11y, 0 violations)
8. ✅ npx playwright test (UX suite, 82 tests)
9. ✅ ux-forbidden-copy
10. ✅ ux-check-master-labels
11. ✅ ux-check-i18n-keys
12. ✅ ux-check-contrast
13. ✅ ux-check-screen-states
14. ✅ secret-scan (0 secrets)
15. ✅ test-secret-scan (17 tests)
16. ✅ check-dependency-cycles (no cycles)
17. ✅ check-compose (YAML structure valid)
18. ✅ check-no-skips (no test.only, test.skip, xit)

**Blockers:**
- `docker compose up` NOT_TESTED (daemon not available)
- LICENSE awaiting user decision

**Verification:**
```bash
bash scripts/verify.sh
```

**Repeatability Test:**
```bash
cd /tmp && git clone <repo> test-clone
cd test-clone
pnpm install --frozen-lockfile
bash scripts/verify.sh
# Must exit 0
```

---

### ADIM 06: CI/CD & Verification
**Status:** IN_PROGRESS

**Required Checks:**
- All ADIM 05 checks (via verify.sh)
- Dev-log privacy (no GPS, phone, email, tokens in logs)
- Skip detection (test.only, test.skip forbidden)
- actionlint (workflow YAML validation)

**New Gates:**
- CI workflow runs (if CI host available)
- Negative tests (verify.sh fails on broken code)
- Log privacy test (scripts/check-log-privacy.sh)

**CI Status:**
- Origin CI: `origin pr checks` available
- GitHub Actions workflows: `.github/workflows/ci.yml`
- **Status:** BLOCKED_ACCESS (no remote CI host configured yet)

**Verification:**
```bash
# Positive test
bash scripts/verify.sh
# Exit 0

# Negative test: inject failing test
echo 'test("broken", () => { expect(true).toBe(false); });' > /tmp/broken.spec.js
# verify.sh should exit 1

# Log privacy
# Start API, make request, check logs
bash scripts/check-log-privacy.sh /tmp/api.log
```

---

### Future ADIMs (07-22)

Quality gates for ADIM 07-22 will be defined as each milestone progresses. Expected gates include:

- **ADIM 07-09:** Database schema, API endpoints, auth
- **ADIM 10-12:** Mobile app builds, native tests
- **ADIM 13-15:** Integration tests, E2E scenarios
- **ADIM 16-18:** Performance, load testing
- **ADIM 19-21:** Security audit, penetration testing
- **ADIM 22:** Production readiness

---

## Branch Protection (Recommended)

**Note:** These are RECOMMENDATIONS only. No branch protection rules are currently applied to this repository.

### Recommended Settings for `main` Branch:

- ✅ Require pull request before merging
- ✅ Require approvals: 1
- ✅ Dismiss stale PR approvals when new commits are pushed
- ✅ Require status checks to pass before merging:
  - `verify` (Quality Gates)
  - `contracts` (Type Check)
  - `secret-scan`
- ✅ Require branches to be up to date before merging
- ✅ Require linear history
- ❌ Do not allow force pushes
- ❌ Do not allow deletions

### Optional Enhanced Checks:

- `android-gradle` (if Android app exists)
- `ios-xcode` (if iOS app exists)
- Code coverage threshold (e.g., 80%)

---

## Skip Detection

**Rule:** Skipped tests do not count as passing tests.

**Forbidden Patterns:**
- `test.only()`
- `it.only()`
- `describe.only()`
- `test.skip()`
- `it.skip()`
- `describe.skip()`
- `xit()`
- `xdescribe()`
- `xtest()`

**Enforcement:**
```bash
node scripts/check-no-skips.js
```

**Exceptions:** None. All tests must run.

---

## CI/CD Platform Status

### Origin CI
- **Available:** Yes
- **Commands:** `origin pr checks`, `origin pr watch`, `origin pr checks --log <job>`
- **Exit Codes:**
  - `0` = All checks passed
  - `1` = Check failed or no checks
  - `8` = Checks pending
- **Configuration:** No `.origin/` config found. Likely uses GitHub Actions workflows.

### GitHub Actions
- **Workflows:** `.github/workflows/ci.yml`
- **Status:** Workflows defined but not tested (no remote execution)
- **act (local):** Docker required (NOT_TESTED - daemon not available)

### Current Status
**BLOCKED_ACCESS:** No remote CI host configured for this repository yet. Workflows are defined and validated but not executing on push/PR events.

---

## Periyodik Kontroller (3-Step Periodic)

These checks run at ADIM 04, 06, and every 3 steps thereafter:

1. **Full verify.sh run**
2. **Dev-log privacy test:**
   - Start API
   - Send test requests (valid + invalid)
   - Check logs for sensitive data (GPS, phone, email, tokens, API keys)
   - Must pass: `bash scripts/check-log-privacy.sh`

---

## References

- `scripts/verify.sh` - Main verification script
- `scripts/check-no-skips.js` - Skip detection
- `scripts/check-log-privacy.sh` - Log privacy check
- `.github/workflows/ci.yml` - CI workflow definition
- `docs/handover/status.json` - ADIM status tracking

---

**Last Updated:** 2026-10-29 (ADIM 06 in progress)
