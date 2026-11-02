# Rollback prosedürü

## Ne zaman

- `SosmeshApiDown` veya `SosmeshHighHttpErrorRate` deploy sonrası
- Health sayfası `major_outage` / `degraded` kalıcı

## Adımlar

1. **Dondur:** yeni deploy durdur; değişken env geri alınmaz (secret repoya yazılmaz).
2. **Önceki imaj/commit:** bilinen iyi sürüme dön (git tag / container digest — ortamınıza göre).
3. **Migration:** geri alınamayan migration varsa forward-fix planı; veri silme yok.
4. **Doğrula:** `/health/ready` 200, `sosmesh_health_database_up` 1, `/metrics` scrape token ile erişilebilir (`Authorization: Bearer $METRICS_SCRAPE_AUTH`).
5. **Status page:** bileşenleri `operational` olarak güncelle (`status-page.md`).

## Kanıt

- Rollback sonrası alert recovery testleri yeşil (CI observability spec).
