# ADIM 53 — Gerçek saat iz kanıt şablonu

**Durum:** NOT_TESTED (şablon; doldurulmadan PASS yazılmaz)

## Ortam

| Alan | Değer |
|------|--------|
| Tarih (UTC) | |
| Saat modeli / Wear OS sürümü | |
| Eşli telefon modeli / Android sürümü | |
| SOSMesh telefon build | |
| SOSMesh wear build (`versionName`) | |
| AAB SHA-256 | |

## Senaryo A — Eşli telefon, SOS onaylı gönderim

| Adım | Beklenen | Kanıt (log ekran görüntüsü / dosya yolu) | Sonuç |
|------|----------|--------------------------------------------|--------|
| 1. Saat uygulamasını aç | «SOS» + «112 yerine geçmez» | | NOT_TESTED |
| 2. Bas → bırak → Gönder | Onay diyaloğu | | NOT_TESTED |
| 3. Telefon outbox | Tek satır `origin=wear_os`, `messageId` = saat wire | `adb logcat` / Room dump (PII redakte) | NOT_TESTED |
| 4. Saat UI | «Telefona kaydedildi»; **sunucuya ulaştı yok** | | NOT_TESTED |
| 5. Gateway (opsiyonel) | Operatör panel iz — yalnızca telefon upload sonrası | trace id | NOT_TESTED |

## Senaryo B — Telefon erişilemez (telefonsuz / kapalı / menzil dışı)

| Adım | Beklenen | Kanıt | Sonuç |
|------|----------|-------|--------|
| 1. Telefonu kapat veya BT kes | | | NOT_TESTED |
| 2. Saatten SOS onayla | «Telefona ulaşılamıyor» | | NOT_TESTED |
| 3. Sahte başarı kontrolü | UI **gönderildi** dememeli | | NOT_TESTED |
| 4. Telefonu aç | Kuyruk aktarımı / retry | | NOT_TESTED |

## Senaryo C — Pil tasarrufu + ambient

| Adım | Beklenen | Kanıt | Sonuç |
|------|----------|-------|--------|
| Pil tasarrufu açık | Retry seyrek; kullanıcı mesajı | | NOT_TESTED |
| Always-on / ambient | Burn-in güvenli gri SOS; detay satırı gizli | | NOT_TESTED |

## İmzalama / Play

| Eylem | Durum |
|-------|--------|
| `SOSMESH_WEAR_RELEASE_*` ile imzalı AAB | BLOCKED_APPROVAL |
| Play Internal track yükleme | BLOCKED_APPROVAL |

## Onay

- Testi yürüten: ___
- PII/log repoya commit edilmedi: [ ]
