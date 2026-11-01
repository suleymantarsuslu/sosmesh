# KVKK / GDPR — Hukuki İnceleme Kontrol Listesi (Taslak)

**Durum:** `hukuki inceleme: NOT_TESTED` — Bu liste teknik hazırlık içindir; avukat veya veri koruma uzmanı onayı olmadan **“tam uyumlu”** denmez.

## Kapsam

| Madde | Teknik karşılık | Kanıt / dosya | İnceleme |
| --- | --- | --- | --- |
| Hukuki dayanak ve aydınlatma (hesapsız SOS) | Web/mobil rıza metinleri | `docs/ux/content-*.json` (`privacy.*`), Android `feature-sos` / `feature-relay` strings | NOT_TESTED |
| Veri minimizasyonu | Röle payload okumaz; operatör metni sentetik/demo ayrımı | ADR-009, data map | NOT_TESTED |
| Saklama süresi | Konfigürasyon zorunlu; varsayılan süre yok | ADR-013, `RETENTION_*` env | NOT_TESTED |
| Silme / erase | `POST /v1/operator/privacy/incidents/:id/erase` | `privacy-adim44.spec.ts` | NOT_TESTED |
| Taşınabilirlik / export | `GET /v1/operator/privacy/incidents/:id/export` | `privacy-adim44.spec.ts` | NOT_TESTED |
| Rol tabanlı erişim | COORDINATOR/ADMIN export & erase | RBAC testleri | NOT_TESTED |
| Denetim izi redaksiyonu | `audit-redaction.util.ts` | API testleri | NOT_TESTED |
| Acil durum erişimi | Politika dokümanı | `docs/privacy/lawful-emergency-access.md` | NOT_TESTED |
| DPIA / LIA gereksinimi | — | Ürün sahibi + hukuk | NOT_TESTED |
| Veri işleme sözleşmeleri (AI sağlayıcı) | AI opsiyonel, insan kararı | ADIM 45 bağımlılığı | NOT_TESTED |

## Onay kaydı (prod öncesi doldurulacak)

| Rol | Ad | Tarih | Sonuç |
| --- | --- | --- | --- |
| Veri koruma / hukuk | — | — | NOT_TESTED |
| Ürün sahibi | — | — | NOT_TESTED |
| Teknik sorumlu | — | — | NOT_TESTED |
