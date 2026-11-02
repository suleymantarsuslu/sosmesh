# Mobil yardım string kaynakları

Yardım **tam ekran** henüz yok; string’ler ADIM 57 ile eklendi ve Settings / gelecek Help ekranı için hazır.

## Android

| Kaynak | Dosya |
| --- | --- |
| TR (varsayılan) | `apps/android/app/src/main/res/values/strings.xml` |
| EN | `apps/android/app/src/main/res/values-en/strings.xml` |

| `name` | Kullanım |
| --- | --- |
| `help_screen_title` | Yardım başlığı |
| `help_not112_banner` | 112 uyarısı |
| `help_ack_levels_title` / `help_ack_levels_body` | 5 ACK açıklaması |
| `help_relay_title` / `help_relay_body` | Opt-in röle, metin okunmaz |
| `help_offline_title` / `help_offline_body` | Çevrimdışı BLE |
| `help_watch_title` / `help_watch_body` | Eşli telefon / saat |
| `help_failed_delivery_title` / `help_failed_delivery_body` | Başarısız iletim |
| `help_troubleshooting_title` / `help_troubleshooting_body` | Sorun giderme özeti |
| `help_limitations_title` / `help_limitations_body` | Bilinen sınırlamalar |
| `help_support_title` / `help_support_body` | Destek (`TODO_APPROVAL`) |
| `home_help_cta` | Ana ekran CTA (ekran bağlantısı sonraki UI adımı) |

Parity test: `apps/android/app/src/test/kotlin/com/sosmesh/android/AppI18nParityTest.kt`

## iOS

| Dil | Dosya |
| --- | --- |
| TR | `apps/ios/SOSMesh/tr.lproj/Localizable.strings` |
| EN | `apps/ios/SOSMesh/en.lproj/Localizable.strings` |

Anahtarlar `help.*` önekli (ör. `help.not112`, `help.ackLevels.body`).

## UX JSON (paylaşılan microcopy)

`docs/ux/content-tr.json` / `content-en.json` — `warnings.not112`, `status.disclaimer`, `privacy.*`.

## Bağlantı (gelecek)

`HomeRoute` / `SettingsView` içinde `home_help_cta` → Help ekranı **ADIM 51–53 paralel kapsamında UI PR’larında** bağlanacak; bu adımda yalnızca string kaynağı.
