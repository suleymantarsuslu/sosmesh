# Changelog

All notable changes to SOSMesh are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0-rc.1] - 2026-11-02

Release candidate **readiness bundle** (ADIM 56). **No git tag pushed** — tagging requires user approval.

### Added

- Release traceability map: `docs/release/traceability.md`, `docs/release/traceability.json` (ADIM 01–58, M0 scenarios, GEÇTİ criteria → tests → CI/report evidence).
- QA summary: `docs/release/qa-summary.json`, `docs/release/release-readiness.md` (defect inventory, npm audit snapshot, blockers).
- Supply chain scripts: `scripts/release/sbom.sh` (CycloneDX SBOM), `scripts/release/checksums.sh` (`docs/release/SHA256SUMS`).
- Demo/mock production separation gate: `tests/chaos/demo-mode-production-separation.test.ts`.
- Verify hooks: `scripts/verify.sh` steps for traceability/QA freshness, SBOM, and checksums.

### Documented (master plan steps summarized)

- **Hackathon core (ADIM 01–25):** Monorepo, contracts, BLE/crypto/transport, Android SOS/relay stack, API ingest/sync, operator web panel, hackathon demo paths — CI-automated portions PASS/PARTIAL per `status.json`; **ADIM 24 physical M0 remains NOT_TESTED**.
- **Product expansion (ADIM 26–42):** Web design system, tasks/notifications, Android polish, iOS/watch/mesh-v2 research — mostly PARTIAL or NOT_STARTED pending devices.
- **Hardening (ADIM 43–50):** Threat model, privacy drafts, Meta AI eval (PARTIAL), load/k6 smoke, observability ADIM 48, web a11y/responsive ADIM 50.
- **Release gates (ADIM 51–55):** Android/iOS/Wear release docs and CI builds; store/deploy/pilot **BLOCKED_APPROVAL** or **NOT_TESTED**.
- **ADIM 56:** Regression/traceability/QA bundle (this release); status **PARTIAL**.
- **ADIM 57–58:** User docs PARTIAL; final handover NOT_STARTED.

### Security

- SBOM generated on Linux CI without repository secrets.
- Checksums cover TypeScript build outputs under `packages/*/dist` and `apps/api/dist` after `pnpm -r build`.

### Known limitations (rc.1)

- Physical device evidence, Apple/Google store submission, legal sign-off, prod deploy, and production secrets (`MODEL_API_KEY`, `METRICS_SCRAPE_AUTH`, spend caps) remain open — see `docs/release/qa-summary.json`.

[1.0.0-rc.1]: https://github.com/suleymantarsuslu/sosmesh/compare/v0.1.0...v1.0.0-rc.1
