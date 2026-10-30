# Periyodik kontrol — ADIM 06–10

Tarih: 2026-10-30 (UTC). Kaynak: yalnızca repoda ve GitHub CI kanıtı; uydurma yok.

## Özet tablo

| ADIM | Başlık | PR | Merge commit | CI run (yeşil) | Durum | NOT_TESTED / borç |
| --- | --- | --- | --- | --- | --- | --- |
| 06 | CI/CD iskeleti | [#16](https://github.com/suleymantarsuslu/sosmesh/pull/16) | `2ca2943` | [41120079781](https://github.com/suleymantarsuslu/sosmesh/actions/runs/41120079781) (main push, success) | PASS | Origin branch protection kullanıcı onayı |
| 07 | Sözleşmeler | [#18](https://github.com/suleymantarsuslu/sosmesh/pull/18) | `e53b66e` | PR #18 CI (Contracts + Verify jobları) | PASS | `docs/api/openapi.yaml` repoda yok |
| 08 | BLE v1 | [#19](https://github.com/suleymantarsuslu/sosmesh/pull/19) + D-08 [#21](https://github.com/suleymantarsuslu/sosmesh/pull/21) | `3e7d263` / `74f4b4c` | [40964679700](https://github.com/suleymantarsuslu/sosmesh/actions/runs/40964679700) | PASS | D-08: %25 kayıp testinde FAILED tam bloklama ile tetikleniyor (`integration.test.ts`) |
| 09 | Kriptografi | [#20](https://github.com/suleymantarsuslu/sosmesh/pull/20) | `3e7d263` | [40964679700](https://github.com/suleymantarsuslu/sosmesh/actions/runs/40964679700) | PASS | Android Keystore / iOS Keychain cihaz NOT_TESTED |
| 10 | Outbox / durum motoru | [#22](https://github.com/suleymantarsuslu/sosmesh/pull/22) | `e2c18af` | [41128740240](https://github.com/suleymantarsuslu/sosmesh/actions/runs/41128740240) | PASS | Android Room / iOS cihaz disk kuyruğu NOT_TESTED; SIGKILL testinde child WAL checkpoint (`outbox.test.ts`) |

## ADIM 06 — kanıt

- `.github/workflows/ci.yml`, `scripts/verify.sh` mevcut.
- PR #16 merge `2ca29432be024a8072c2d1fbe492fc5d1bb3a6d7`.
- `docs/handover/status.json` içindeki erken “Origin CI yok” notu güncellenmiş durumda değil; GitHub Actions `CI` workflow main push’ta koşuyor (ör. run `41120079781` success).

## ADIM 07 — kanıt

- `packages/contracts`, `packages/contracts-kotlin`, `packages/contracts-swift`, `packages/fixtures/protocol-v1`.
- Cross-language testler: `pnpm --filter @sosmesh/contracts test`, Gradle `./gradlew test`, Swift `swift test` (CI `cross-language` job).

## ADIM 08 — kanıt

- `packages/ble-protocol`, `docs/protocol/ble-v1.md`, `packages/fixtures/ble/test-vectors.json`.
- D-08 kapanış: explicit `RESUME_REQUEST` PR #21 → main `74f4b4c`.
- Bilinen borç: yüksek kayıp senaryosunda sender `FAILED` ancak resume sonrası `COMPLETED` — test bilinçli olarak `setDropAcksToSender` / `setBlockDataToReceiver` ile zorlanıyor.

## ADIM 09 — kanıt

- `packages/contracts/src/crypto.ts`, golden vectors üç dilde byte-eşit (`verify.sh` golden-vector-equality).
- Native Keystore/Keychain entegrasyonu henüz yok → NOT_TESTED.

## ADIM 10 — kanıt

- `packages/transport`, Kotlin/Swift outbox adapter testleri, `docs/transport/states.md`, `docs/adr/ADR-009-transport-terminal-states.md`.
- PR #22 merge `e2c18af29fb6ac62980bae7774f8d8748a113588`, CI run `41128740240` success.
- Android Room / iOS cihaz persistence NOT_TESTED (TS SQLite + JVM + Swift in-memory CI PASS).

## ADIM 11 (bu PR)

- Teslim: `tools/mesh-simulator`, `tests/chaos`, `docs/tests/lab-matrix.md`.
- `status.json` adım 11: CI yeşil olunca PASS işaretlenecek.
