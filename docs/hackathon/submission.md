# Hackathon teslim checklist

**Dal durumu:** ADIM 25 **PARTIAL** — repo hazır; form yükleme/video/kullanıcı onayı bekleniyor.

## Repo ve çalıştırma

- [ ] Temiz checkout: `pnpm bootstrap`
- [ ] Kalite kapıları: `pnpm -r build`, `pnpm test`, `bash scripts/verify.sh`
- [ ] Smoke (API+web): `bash scripts/smoke.sh` (PostgreSQL gerekir)
- [ ] Android (CI veya yerel SDK): `cd apps/android && ./gradlew assembleDebug testDebugUnitTest lintDebug ktlintCheck`

## Demo ve dürüstlük

- [ ] `demo/storyboard.md` ile sunum akışı hazır
- [ ] Fiziksel M0 videosu **yoksa** simülasyonu gerçek diye sunmama taahhüdü
- [ ] Web mock demo: **DEMO MODE** etiketi (`OPERATOR_E2E_MOCK=1`, production’da kapalı)
- [ ] `docs/tests/m0-physical-report.md` durumu **NOT_TESTED** (henüz PASS yok)

## Dokümantasyon

- [ ] README hızlı kurulum + sınırlamalar
- [ ] `docs/architecture/system-diagram.md` (mermaid)
- [ ] `docs/architecture/requirements-map.md` (master plan → kod/test, status.json kaynaklı)

## Güvenlik / gizlilik

- [ ] Repoda secret yok; `.env` gitignore
- [ ] 112/911 uyarısı README ve onboarding’de
- [ ] AI karar vermez; operatör onayı zorunlu

## Yarışma formu (kullanıcı doğrulayacak)

- [ ] Resmî teslim sayfasındaki **güncel kuralları** oku ve madde madde buraya işaretle (URL ve deadline kullanıcı tarafından eklenecek — agent uydurma kural yazmaz)
- [ ] Video süresi / format / repo linki gereksinimleri forma göre kontrol
- [ ] Takım adı, lisans, üçüncü taraf atıfları (OSM, MapLibre, vb.)

## Release etiketi (henüz uygulanmadı)

**Tag oluşturulmadı / push edilmedi.** Kullanıcı onayı sonrası önerilen commit:

- **Önerilen SHA:** `main` üzerinde ADIM 24–25 PR merge commit’i (PR merge edildikten sonra `git rev-parse HEAD`)
- **Önerilen etiket adı:** `demo-2026-hackathon` (yalnız öneri; `git tag` kullanıcı onayı ile)
