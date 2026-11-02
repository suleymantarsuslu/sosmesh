# Gizlilik inceleme kontrol listesi (teknik hazırlık)

**ADIM 57** · **Hukuki inceleme:** `BLOCKED` — kullanıcı / hukuk onayı olmadan **PASS yazılmaz**.

Bu liste yalnızca ürün ve mühendislik hazırlığını tarar. KVKK/GDP R detay matrisi: [`kvkk-gdpr-legal-review-checklist.md`](kvkk-gdpr-legal-review-checklist.md).

---

## Kullanıcıya açık metinler

| # | Kontrol | Kanıt | Durum |
| --- | --- | --- | --- |
| 1 | 112 / resmî acil servis feragati (TR/EN) | `docs/user/*.md`, `docs/ux/content-*.json` (`warnings.not112`), web `/operator/help` | Hazır — hukuk NOT_TESTED |
| 2 | Durum timeline = garanti değil | `warnings.noFalseHope`, ACK yardım metinleri | Hazır — NOT_TESTED |
| 3 | Röle opt-in; içerik okunmaz | Röle strings, `privacy.relayOptIn` | Hazır — NOT_TESTED |
| 4 | Peer ACK ≠ operatör / sunucu okuma | ACK tabloları, `web.help.ackBody` | Hazır — NOT_TESTED |
| 5 | Bilinen platform sınırları (Apple BG, saat) | `platform-destek-matrisi.md`, iOS limitation copy | Hazır — NOT_TESTED |

---

## Belgeler ve bağlantılar

| # | Kontrol | Kanıt | Durum |
| --- | --- | --- | --- |
| 6 | Gizlilik taslağı erişilebilir | `docs/legal/privacy-policy-draft.md` | Taslak — NOT_TESTED |
| 7 | Kullanım koşulları taslağı | `docs/legal/terms-of-use-draft.md` | Taslak — NOT_TESTED |
| 8 | Güvenlik açığı yolu (yer tutucu) | `SECURITY.md` (`GUVENLIK_BILDIRIM_TBD`) | Yer tutucu — TODO_APPROVAL workflow |
| 9 | Destek iletişimi icat edilmedi | `DESTEK_ILETISIM_TBD` / `DESTEK_EPOSTA_TBD` / `DESTEK_TELEFON_TBD` | BLOCKED_APPROVAL |

---

## Operasyonel gizlilik (teknik)

| # | Kontrol | Kanıt | Durum |
| --- | --- | --- | --- |
| 10 | Saklama / silme / export uçları | ADR-013, ADIM 44 API testleri | CI — hukuk NOT_TESTED |
| 11 | Denetim izi redaksiyonu | `audit-redaction.util.ts` | CI — NOT_TESTED |
| 12 | AI opsiyonel; insan kararı | ADIM 45, operatör UI etiketleri | PARTIAL — NOT_TESTED |

---

## Onay kaydı (doldurulmadan prod yok)

| Rol | Ad | Tarih | Sonuç |
| --- | --- | --- | --- |
| Hukuk / veri koruma | — | — | BLOCKED |
| Ürün sahibi | — | — | BLOCKED |
| Teknik sorumlu | — | — | BLOCKED |

**Not:** Bu dosya ADIM 57’de **PARTIAL** kalır; yalnızca checklist tamamlanması PASS sayılmaz.
