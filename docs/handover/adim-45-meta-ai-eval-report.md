# ADIM 45 — Meta AI değerlendirme ve maliyet sınırı (Teslim raporu)

**Dal:** `cursor/meta-ai-eval-cost-limit-bd31`  
**Base PR zinciri:** `cursor/privacy-adim-44-data-consent-7d56` (PR #51)  
**status.json:** ADIM 45 → **PARTIAL** (gerçek model doğruluğu NOT_TESTED; B-07 bütçe onayı)

## Özet

Sentetik **113** eval fixture, mock tabanlı alan doğruluğu koşucusu, şema dışı çıktı için güvenli fallback, prompt de-identification, olay başına token bütçesi + mevcut rate limit / günlük harcama tavanı / AI kapalı modu, izleme metrikleri ve `docs/ai/model-card.md` eklendi. CI ve yerel testler **gerçek Meta modeli çağırmaz** (`gerçek model doğruluğu: NOT_TESTED`).

## Kapı tablosu (yerel koşu)

| Kapı | Sonuç | Not |
|------|--------|-----|
| `pnpm -r build` | PASS | `reports/build.log` |
| `pnpm test` | PASS | `reports/test.log` |
| `bash scripts/verify.sh` | **Kısmi FAIL** | `a11y-web`, `playwright-ux`: Playwright chromium binary yok (CI `npx playwright install` ile doğrular) |
| `packages/contracts-kotlin ./gradlew test` | **NOT_RUN (yerel)** | JDK 17 toolchain yok; verify altın vektör `cmp` ile PASS |
| Android SDK Gradle | NOT_RUN | Bu VM’de tam SDK yok; CI `detect-mobile` job’ları doğrular |

## Mock eval (deterministik)

- Koşucu: `apps/api/src/ai/evals/eval-runner.ts` — `MockMetaProvider` + golden alan karşılaştırması.
- **gerçek model doğruluğu: NOT_TESTED** — rapor yalnızca fixture yanıtları içindir.
- Fixture sayısı: `EVAL_FIXTURE_COUNT` ≥ 100 (`fixtures.ts`).

## GEÇTİ / PARTIAL gerekçesi

| Ölçüt | Durum |
|--------|--------|
| Bilinmeyen bilgi uydurulmuyor (fallback) | PASS — `safe-fallback.ts` + `ai-adim45.spec.ts` |
| Model kesintisi ingest’i bloklamıyor | PASS — `ai-worker.spec.ts` |
| AI operatör adına triyaj/kurtarma kararı vermez | PASS — şema yasak alanlar + fixture golden |
| Gerçek model alan doğruluğu | **NOT_TESTED** |
| Production spend onayı (B-07) | **BLOCKED_APPROVAL** → PARTIAL |

## Ana dosyalar

- Eval: `apps/api/src/ai/evals/*`
- Maliyet/token: `ai-guards.ts`, `ai.constants.ts`, `ai-job.service.ts`, `ai-metrics.ts`
- Güvenlik: `schemas/safe-fallback.ts`, `deidentify-plaintext.ts`, `system-prompt.ts`
- Dokümantasyon: `docs/ai/model-card.md`
