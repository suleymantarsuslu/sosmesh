# SOSMesh release readiness (ADIM 56)

**Release candidate:** `v1.0.0-rc.1` (tag **not** pushed — requires user approval)  
**ADIM 56 status:** **PARTIAL** — device evidence and explicit user approval pending  
**Last updated:** 2026-11-02 (UTC)

## Executive summary

Linux CI gates (`Verify Quality Gates`, contract tests, Android Gradle on GitHub-hosted runners) are green when `bash scripts/verify.sh` exits 0. **Production readiness is not claimed:** physical M0/M1 flows, Apple signing, store review, legal review, staging/prod deploy, and several secrets remain **NOT_TESTED** or **BLOCKED_APPROVAL** per [`docs/handover/status.json`](../handover/status.json).

## Traceability

| Artifact | Purpose |
| --- | --- |
| [`traceability.md`](./traceability.md) | Human-readable map: ADIM 01–58, M0 scenarios, GEÇTİ criteria → tests → evidence |
| [`traceability.json`](./traceability.json) | Machine-readable same map (`verification_status` mirrors status.json) |
| [`qa-summary.json`](./qa-summary.json) | Defect inventory, npm audit snapshot, open blockers |

Regenerate (after status.json changes):

```bash
node scripts/release/generate-traceability.mjs
node scripts/release/generate-qa-summary.mjs
```

## Supply chain artifacts (Linux, no secrets)

| Script | Output | CI hook |
| --- | --- | --- |
| `bash scripts/release/sbom.sh` | `docs/release/sbom.cdx.json` (CycloneDX via `@cyclonedx/cyclonedx-npm`) | `scripts/verify.sh` step **release-sbom** |
| `bash scripts/release/checksums.sh` | `docs/release/SHA256SUMS` (post `pnpm -r build`) | `scripts/verify.sh` step **release-checksums** |

Verify checksums locally:

```bash
pnpm -r build
bash scripts/release/checksums.sh
sha256sum -c docs/release/SHA256SUMS
```

## Version tag and signing (requires user approval)

These commands are **documented only** — the agent does **not** create tags, sign with real keys, or deploy.

```bash
# User approval required before any of:
git tag -a v1.0.0-rc.1 -m "SOSMesh v1.0.0-rc.1"
git push origin v1.0.0-rc.1

# Sign checksums / artifacts with your org key (example):
# gpg --detach-sign docs/release/SHA256SUMS
```

## Demo / mock separation

Production must not enable operator E2E mock or Android demo banners on store-bound flavors.

| Surface | Guard |
| --- | --- |
| Web | `apps/web/lib/config.ts` + `config.test.ts`, `demo-mode.test.ts` |
| Android prod | `ProdFlavorBuildConfigTest.kt`, `DemoModeConfigTest.kt` |
| Repo gate | `tests/chaos/demo-mode-production-separation.test.ts` |

## Open blockers snapshot (honest)

| Area | Status | Notes |
| --- | --- | --- |
| Device tests (M0/M1, wearables) | **NOT_TESTED** | B-02, B-04; ADIM 24, 51–53 |
| Apple signing / TestFlight | **BLOCKED_APPROVAL** | B-06, B-13; Mac worker |
| Store review (Play / App Store) | **BLOCKED_APPROVAL** | ADIM 51–53 docs ready, not submitted |
| Legal / KVKK review | **NOT_TESTED** | Checklist draft only |
| AI spend cap (prod) | **BLOCKED_APPROVAL** | B-07 |
| Staging / prod deploy | **BLOCKED_APPROVAL** | ADIM 54 PARTIAL |
| `METRICS_SCRAPE_AUTH` (prod) | **BLOCKED_APPROVAL** | Metrics scrape guard needs prod secret |

See also [`docs/blockers.md`](../blockers.md) and `qa-summary.json` → `open_blockers_snapshot`.

## QA defect policy for rc.1

- **Critical / high:** Listed in `qa-summary.json` with owner **TBD** when unresolved (never hidden).
- **Medium:** Workaround + release note in scan entries.
- **Rule:** No required item marked PASS without matching evidence in traceability.json.

## Related CHANGELOG

See [`CHANGELOG.md`](../../CHANGELOG.md) at repo root for step-level summary for `v1.0.0-rc.1`.
