# SOSMesh — Senaryo İzlenebilirlik Matrisi

**Amaç:** Her gereksinimi test senaryosuna, gelecekte uygulayacak ADIM'a ve kanıt türüne bağlamak.

**Durum:** ADIM 02 (M0 kabul kapsamı)

---

## Kısaltmalar

- **Kanıt Türü:**
  - **Unit:** Birim test (Jest/JUnit/XCTest)
  - **Sim:** Radyo simülatörü (ADIM 11)
  - **Device:** Gerçek fiziksel cihaz (Android/iOS)
  - **E2E:** Uçtan uca entegrasyon (API+Panel+Cihaz)
  - **Manual:** Manuel test/gözlem
  - **Doc:** Dokümantasyon incelemesi

---

## Tablo: Gereksinim → Senaryo → ADIM → Kanıt

| Gereksinim | Master Bölüm/Ref | Senaryo Adı | Feature Etiketi | Uygulayacak ADIM | Kanıt Türü | Durum |
|------------|------------------|-------------|-----------------|------------------|-----------|-------|
| **Afetzede offline SOS oluşturma** | §07 U1 | Afetzede offline SOS oluşturur | @U1 | 13 (Android SOS ekranı) | Device | NOT_STARTED |
| Konum izni opsiyonel | §07 U1, §04 izinler | Konum izni olmadan SOS oluşturma | @U1 @negative | 13 | Device | NOT_STARTED |
| SOS cihazda kalıcı | §10 outbox | (U1 senaryosunun devamı) | @U1 | 10, 13 | Device + Unit | NOT_STARTED |
| BLE peer discovery | §08 BLE v1 | Gönüllü röle BLE ile SOS alır | @U2 | 14 (Android BLE) | Device | NOT_STARTED |
| Chunk transfer + CRC | §08 BLE v1 | (U2 senaryosunun devamı) | @U2 | 15 (Android transfer) | Device + Sim | NOT_STARTED |
| PEER_RECEIVED ack | §08 ACK | (U2 senaryosunun devamı) | @U2 | 15 | Device | NOT_STARTED |
| **Röle gizliliği (payload görmez)** | §09 kriptografi | Röle şifreli payload'ı görmez | @U2 | 9, 15 | Device + Manual | NOT_STARTED |
| Bluetooth kapalı kontrolü | §12 izinler | Bluetooth kapalıyken röle çalışmaz | @U2 @negative | 12, 16 | Device | NOT_STARTED |
| **Röle upload (internet varsa)** | §19 gateway sync | Röle internete ulaşınca sunucuya upload yapar | @U2 | 16, 19 | Device + E2E | NOT_STARTED |
| **M0 uçtan uca akış** | §24 M0 senaryo | İki Android ile M0 uçtan uca akış | @M0 | 24 (M0 entegrasyon) | Device + E2E | NOT_STARTED |
| Idempotency (duplicate→tek kayıt) | §18 ingest | Duplicate paket tek vaka oluşturur | @M0 @negative | 18 | E2E + Unit | NOT_STARTED |
| **Offline yolda Meta çağrısı yok** | §20 AI, kritik yol | Offline yolda Meta API çağrısı yapılmaz | @M0 @negative | 16, 20 | Device + E2E | NOT_STARTED |
| **Operatör vaka görüntüleme** | §21, §23 panel | Operatör panelde vaka görüntüler | @U3 | 21, 23 | E2E | NOT_STARTED |
| RBAC — yetkisiz erişim | §21 auth | Yetkisiz rol vaka göremez | @U3 @negative | 21 | E2E + Unit | NOT_STARTED |
| **Meta AI sınıflandırma** | §20 AI | Meta AI SOS'u sınıflandırır | @U4 | 20 | E2E + Unit | NOT_STARTED |
| AI anahtar yoksa BLOCKED_SECRET | §20 AI, B-05 | Meta API anahtarı yoksa AI adımı atlanır | @U4 @negative | 20, 24 | E2E | NOT_STARTED |
| AI timeout/5xx hatası | §20 AI | Meta AI timeout veya 5xx hatası | @U4 @negative | 20 | E2E + Unit | NOT_STARTED |
| **AI halüsinasyon önleme** | §20 AI, §45 eval | AI halüsinasyon — uydurma | @U4 @negative | 20, 45 | E2E + Manual | NOT_STARTED |
| **İzin reddi akışı** | §12 izinler | İzin reddi akışı | @U5 @negative | 12 | Device | NOT_STARTED |
| API 429 rate limit | §18 ingest, §19 sync | API 429 rate limit | @U5 @negative | 18, 19 | E2E + Unit | NOT_STARTED |
| API 500 server error | §18 ingest, §19 sync | API 500 Internal Server Error | @U5 @negative | 18, 19 | E2E + Unit | NOT_STARTED |
| **Demo/simülasyon etiketi** | §02 kapsam, §04 UX | Demo/simülasyon açıkça etiketlenir | @negative | 04, 13, 21 | Manual + Doc | NOT_STARTED |
| **112 uyarısı onboarding** | §02 kapsam, §04 UX | 112 uyarısı onboarding'de zorunlu | @negative | 04, 13 | Manual + Doc | NOT_STARTED |
| **Yasak etiketler kontrol** | §02 başarı sözleşmesi | Yasak etiketler UI'da görünmez | @negative | 13, 21, 04 | Manual + Doc | NOT_STARTED |
| Beş SOS durumu sırası | §08 ACK, §10 durum | (M0 senaryosunun devamı) | @M0 | 10, 13, 15, 18, 23 | E2E | NOT_STARTED |
| Backend iskelet (API health) | §17 backend | (Arka plan ön koşulu) | — | 17 | Unit | NOT_STARTED |
| Canlı feed (SSE/WebSocket) | §19 gateway sync | (U3 senaryosunun devamı) | @U3 | 19, 21, 22 | E2E | NOT_STARTED |
| OPERATOR_SEEN event | §23 operatör | (U3 senaryosunun devamı) | @U3 | 23 | E2E + Unit | NOT_STARTED |
| AI çıktısı "Öneri" başlığı | §20 AI, §23 operatör | (U3/U4 senaryolarında kontrol) | @U3, @U4 | 20, 23 | Manual + Doc | NOT_STARTED |
| Operatör manuel override | §23 operatör | (U3 senaryosunun devamı) | @U3 | 23 | E2E | NOT_STARTED |

---

## Kapsam Dışı Gereksinimler (M0'da YOK)

| Gereksinim | Master Bölüm/Ref | Kapsam Dışı Nedeni | İlerideki ADIM |
|------------|------------------|-------------------|----------------|
| iOS/watchOS | §31–39 | M0 yalnızca Android | 31 (iOS), 37 (watchOS) |
| Çok atlamalı mesh (A→B→C) | §40 mesh v2 | M0 tek hop (A→B) | 40 |
| Wear OS | §35–36 | M0 telefon odaklı | 35 |
| Ekip atama/görev yönetimi | §27 tasks | M0 yalnızca görüntüleme | 27 |
| Güvenlik audit (STRIDE) | §43 security | M1 sonrası | 43 |
| Privacy/KVKK audit | §44 privacy | M1 sonrası | 44 |
| Performans/yük testleri | §47 perf | M1 sonrası | 47 |
| Production deployment | §54 deploy | Tam ürün | 54 |
| Pilot kullanıcı testi | §55 pilot | Tam ürün | 55 |
| Apple Developer hesabı/imzalama | B-06 | M0 simülatör/dev build | 52 (TestFlight) |
| Google Play Console | B-06 | M0 APK yeterli | 51 (Play release) |
| Docker daemon (Mac) | B-08 | M0 cloud/Linux kutu | 05 (Compose) |
| Fiziksel Wear OS/Apple Watch | B-04 | M1 sonrası | 35, 37 |

---

## Senaryo Sayı Özeti (m0-acceptance.feature)

| Etiket | Senaryo Sayısı | Açıklama |
|--------|----------------|----------|
| @U1 | 2 | Afetzede offline SOS + konum izni olmadan |
| @U2 | 4 | Röle BLE alma, gizlilik, upload, BT kapalı |
| @U3 | 2 | Operatör görüntüleme + RBAC |
| @U4 | 4 | AI sınıflandırma + anahtar yok + timeout + halüsinasyon |
| @U5 | 3 | İzin reddi, 429, 500 |
| @M0 | 2 | Uçtan uca akış + idempotency |
| @negative | 13 | Tüm negatif senaryolar |
| @device-required | 10 | Fiziksel cihaz gerektiren senaryolar |
| **Toplam** | **19** | Benzersiz senaryo sayısı |

---

## Sonraki İyileştirmeler

1. **ADIM 05:** Monorepo iskelet kurulduktan sonra unit test dosyaları oluşturulacak.
2. **ADIM 11:** Radyo simülatörü ile chunk transfer/CRC/dedup senaryoları tekrarlanacak.
3. **ADIM 24:** M0 fiziksel test raporunda bu matristeki @M0 ve @device-required senaryolar kanıtlanacak.
4. **ADIM 43:** Güvenlik audit'te her negatif senaryonun kötüye kullanım vektörü analiz edilecek.

---

**Not:** Bu matris canlı dokümandır; her ADIM'da güncellenir. ADIM 02 sonunda tüm gereksinimler kapsanmış veya "kapsam dışı" işaretlidir.
