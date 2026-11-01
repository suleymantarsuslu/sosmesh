# Master plan → kod / test eşlemesi (M0 kapısı)

Kaynak durumlar: [`docs/handover/status.json`](../handover/status.json) (`PASS`, `PARTIAL`, `NOT_TESTED`, …). Bu tablo otomatik özet; **tek doğruluk kaynağı status.json**’dur.

| Adım | Başlık | Durum | Kod / test yolları |
| --- | --- | --- | --- |
| 01 | Keşif | PASS | `docs/00-access-inventory.md`, `scripts/secret-scan.sh` |
| 02 | PRD / M0 BDD | PASS | `docs/product/prd.md`, `docs/tests/m0-acceptance.feature` |
| 03 | Mimari ADR | PASS | `docs/architecture/`, `docs/adr/` |
| 04 | UX tasarım | ACCEPTED_WITH_DEBT | `packages/design-tokens`, `docs/ux/` |
| 05 | Monorepo bootstrap | PASS | `scripts/bootstrap.sh`, `README.md` |
| 06 | CI / verify | PASS | `.github/workflows`, `scripts/verify.sh` |
| 07 | Sözleşmeler | PASS | `packages/contracts`, `docs/api/openapi.yaml` |
| 08 | BLE v1 | PASS | `packages/ble-protocol`, `docs/protocol/ble-v1.md` |
| 09 | Kripto | PASS | `packages/contracts/crypto-test-vectors` |
| 10 | Outbox / durum | PASS | `packages/transport`, `docs/transport/states.md` |
| 11 | Mesh simülatör | PASS | `tools/mesh-simulator`, `tests/chaos/` |
| 12 | Android iskelet | PARTIAL | `apps/android/app`, Gradle CI |
| 13 | Android SOS UI | PARTIAL | `apps/android/feature-sos`, Robolectric |
| 14 | Android BLE | PARTIAL | `apps/android/core/ble`, `docs/tests/android-radio.md` |
| 15 | Android transfer | PARTIAL | `apps/android/core/protocol`, `docs/tests/android-transfer.md` |
| 16 | Android röle | PARTIAL | `apps/android/feature-relay`, `docs/tests/background-android.md` |
| 17 | Backend iskelet | PARTIAL | `apps/api`, Prisma migrations |
| 18 | Ingest | PASS | `apps/api/src/ingest`, `apps/api/test/ingest.spec.ts` |
| 19 | Sync / SSE | PARTIAL | `apps/api/src/sync`, `apps/api/test/sync-events.spec.ts` |
| 20 | Meta AI | PARTIAL | `apps/api/src/ai`, `apps/api/test/ai-meta.spec.ts` |
| 21 | Operatör paneli | PARTIAL | `apps/web/app/(operator)`, Playwright panel |
| 22 | Harita / liste | PARTIAL | `apps/web/features/map`, `tests/ux/operator-map.spec.js` |
| 23 | Vaka ayrıntı / AI UI | PARTIAL | `apps/web/features/cases`, `apps/api/test/operator-case-detail.spec.ts` |
| 24 | M0 fiziksel E2E | NOT_TESTED | `docs/tests/m0-physical-report.md`, `scripts/m0/*`, `evidence/m0/` |
| 25 | Hackathon demo | PARTIAL | `demo/storyboard.md`, `docs/hackathon/submission.md`, DEMO MODE web |

## Yanlış yeşil güven — otomatik denetimler

| Alan | Test / script |
| --- | --- |
| Yasak UX metni | `scripts/ux-forbidden-copy.js`, `tests/chaos/ux-forbidden-simulation.test.ts` |
| Upload hatası → SERVER_ACCEPTED yok | `apps/android/.../RelayUploadExecutorTest.kt` |
| Harita test modu production’da kapalı | `apps/web/features/map/map-config.test.ts` |
| Mock demo production’da kapalı | `apps/web/lib/config.test.ts` |
| Envelope dizi reddi | `apps/api/test/ingest.spec.ts` |
| GPS bilinmiyor → pin yok | `apps/web/features/case-list/geo.test.ts` |
| AI taslak etiketi | `apps/web/features/cases/ai-panel.test.ts` |

## Ertelenen ağır testler

- Mutation / geniş görsel regresyon: **ERTELENDİ** (status.json notları)
- Fiziksel BLE / TalkBack: **NOT_TESTED** (ADIM 24 hazırlık tamam, kanıt yok)
