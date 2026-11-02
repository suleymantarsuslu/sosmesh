# Platform destek matrisi ve cihaz içi uyarı politikası

**ADIM 57** — Teknik referans; mağaza/prod dağıtım `BLOCKED_APPROVAL`.

## Minimum sürüm / destek matrisi

| Bileşen | Min sürüm | Hedef / test | Destek sınıfı | Fiziksel kanıt |
| --- | --- | --- | --- | --- |
| Android telefon | API 26 (Android 8.0) | targetSdk 35 | Desteklenen (ADR-010) | Android 12–16 matrisi **NOT_TESTED** |
| Android Wear | API 30 | eşli telefon gerekir | Deneysel companion | **NOT_TESTED** |
| iOS | 17.0+ | Xcode 15+ | Desteklenen hedef | **NOT_TESTED** |
| watchOS | 10.0+ | eşli iPhone | Companion SOS | **NOT_TESTED** |
| Operatör web | Modern evergreen Chromium/Safari/Firefox | Next.js 14 | Panel + yardım sayfası | Playwright axe (CI) |
| API / ingest | Node 20+ | Docker compose | Operatör + gizlilik uçları | Jest (CI) |

Kaynak: [`apps/android/README.md`](../../apps/android/README.md), [`apps/ios/README.md`](../../apps/ios/README.md), [`docs/compat/cross-platform-matrix.csv`](../compat/cross-platform-matrix.csv).

### Özellik → platform notu

| Özellik | Android | iOS | Wear / Watch |
| --- | --- | --- | --- |
| Offline BLE SOS | Evet (AI’sız) | Evet (sınırlı arka plan) | Telefona iletir |
| Gönüllü röle | Opt-in | Opt-in / deneysel multi-hop flag | Desteklenmez iddiası yok |
| 5 ACK zaman çizelgesi | Evet | Evet | Kısaltılmış metin |
| Operatör paneli | — | — | — |

---

## Cihaz içi uyarı politikası

Aşağıdaki uyarılar **her major sürümde** kullanıcıya gösterilir veya kalıcı erişilebilir metin olarak sunulur:

| Uyarı | Nerede | Zorunlu |
| --- | --- | --- |
| **112 yerine geçmez** | Onboarding, SOS öncesi, durum ekranı, ayarlar, mobil `help_*` / `status_not112_*`, web `/operator/help` | Evet |
| **Durum = garanti değil** | Durum timeline, `warnings.noFalseHope`, web yardım | Evet |
| **Röle içerik okumaz** | Röle opt-in, relay education strings | Evet |
| **Peer ACK ≠ operatör** | Yardım metinleri, ACK seviye tablosu | Evet |
| **Apple arka plan / force-quit** | iOS `ios.limitation.*`, kullanıcı rehberi | Evet |
| **Saat bağımsız mesh yok** | Wear/watch rehberi, `mobile-help-strings` | Evet |
| **DEMO / geliştirme derlemesi** | `demo_mode_banner` (debug builds) | Derleme tipine göre |
| **Fiziksel test NOT_TESTED** | Platform matrisi, radio debug disclaimer | Belgelerde |

### Onay kayıtları (prod öncesi)

| Kontrol | Durum |
| --- | --- |
| Hukuki metin onayı | `NOT_TESTED` — [`docs/legal/kvkk-gdpr-legal-review-checklist.md`](../legal/kvkk-gdpr-legal-review-checklist.md) |
| Destek e-posta / telefon | `TODO_APPROVAL` |
| Mağaza listeleme metinleri | `BLOCKED_APPROVAL` |

---

## Prod / mağaza (uygulanmadı)

| Eylem | Durum |
| --- | --- |
| Play Console / App Store Connect | Hazır belge, **BLOCKED_APPROVAL** |
| Prod imzalama anahtarı | **BLOCKED_APPROVAL** |
| Staging/prod deploy, DNS, TLS | **BLOCKED_APPROVAL** |
| Public push bildirimleri | **BLOCKED_APPROVAL** |
