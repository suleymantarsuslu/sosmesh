# ADIM 46 — AI yardım planlama taslakları ve kaynak eşleştirme (Teslim raporu)

**Dal:** `cursor/adim-46-ai-recommendation-assignment-11ce`  
**Base:** `cursor/meta-ai-eval-cost-limit-bd31` (PR #52 zinciri)  
**PR:** PR #52'ye bağlı (zincir)  
**status.json:** ADIM 46 → **PARTIAL** (gerçek model / fiziksel sevk kanıtı yok)

## Özet

Onaylı sentetik kaynak kataloğu + deterministik mesafe/müsaitlik motoru (AI’sız), isteğe bağlı AI gerekçe metni (ADIM 45 guard/de-identify/fallback yolu, varsayılan **kapalı**), REST öneri/red/onay/geri bildirim API’si ve web’de harita + vaka detayında **atama önizlemesi** eklendi. Atama yalnızca koordinatör onayı + `assigneeId` ile `work_task` olarak commit edilir; operatör onay denemesi **403**. Otomatik fiziksel sevk yok.

## Kapı tablosu (yerel koşu)

| Kapı | Sonuç | Not |
|------|--------|-----|
| `pnpm -r build` | PASS | monorepo build |
| `pnpm test` | **Kısmi** | `apps/api` tam suite cwd=`apps/api` PASS; kök `pnpm -r test` ara sıra `notifications-adim28` flakiness (ortam) |
| `bash scripts/verify.sh` | **Kısmi FAIL** | `a11y-web`, `playwright-ux` (Chromium yok), `secret-scan` (mevcut repo bulguları); `check-openapi` generate sonrası yeşil |
| `packages/contracts-kotlin ./gradlew test` | **NOT_RUN (yerel)** | JDK 17 toolchain yok; CI doğrular |
| Android SDK Gradle | **NOT_RUN** | Bu VM’de tam SDK yok; CI doğrular |

## GEÇTİ / PARTIAL

| Ölçüt | Durum |
|--------|--------|
| Öneri reddedilebilir | PASS — `PATCH .../reject` + audit |
| Otomatik fiziksel sevk yok | PASS — yalnızca koordinatör confirm → `work_task` |
| Müsait olmayan ekip / GPS / bayat / kaynak yok senaryoları | PASS — `recommendation-adim46.spec.ts`, `matching-engine.spec.ts` |
| AI triyaj/kurtarma kararı vermez | PASS — UI disclaimer + yasak içerik filtresi rationale’de |
| Gerçek model / canlı AI gerekçe | **NOT_TESTED** |
| Fiziksel sevk / saha doğrulama | **NOT_TESTED** |

## Ana dosyalar

- API: `apps/api/src/recommendation/*`, migration `20261101220000_adim46_recommendations`
- Test: `apps/api/test/recommendation-adim46.spec.ts`
- Web: `apps/web/features/assignment/*`, `CasesView.tsx`, `CaseDetailView.tsx`, `OperatorMap.tsx`
- Metrik: `recordRecommendationFeedbackForScoring` — `apps/api/src/ai/ai-metrics.ts` (canlı eğitim yok, `liveTraining: false` audit)

## HEAD

Commit: `1722727` (push sonrası CI run id eklenecek).
