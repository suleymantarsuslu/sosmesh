# SOSMesh Adım Dizini (ADIM 01–58)

Tier: H = Hackathon/Çekirdek, P = Tam ürün, E = Deneysel/donanıma bağlı.

| ID | Başlık | Tier | Bağımlılık |
|---|---|---|---|
| 01 | Geliştirme yetkileri ve keşif | H | — |
| 02 | Ürün kapsamı, kullanım riski ve M0 kapısı | H | 01 |
| 03 | Mimari ADR ve monorepo tasarımı | H | 02 |
| 04 | UX bilgi mimarisi ve tasarım sistemi | H | 02, 03 |
| 05 | Monorepo, standartlar ve local geliştirme | H | 03, 04 |
| 06 | CI/CD ve doğrulama iskeleti | H | 05 |
| 07 | Ortak şema ve çapraz dil sözleşmeleri | H | 03, 05, 06 |
| 08 | BLE haberleşme v1 tasarımı | H | 07 |
| 09 | Kriptografi ve yerel mahremiyet | H | 07, 08 |
| 10 | Outbox, store-and-forward ve durum motoru | H | 08, 09 |
| 11 | Radyo simülatörü ve test laboratuvarı | H | 08, 09, 10 |
| 12 | Android uygulama iskeleti ve izinler | H | 04, 07, 10 |
| 13 | Android afetzede SOS ekranı | H | 10, 12 |
| 14 | Android BLE central/peripheral ve peer keşfi | H | 08, 11, 12 |
| 15 | Android SOS transferi ve ack doğrulaması | H | 09, 10, 13, 14 |
| 16 | Android röle modu, batarya ve background | H | 15 |
| 17 | Backend iskeleti ve veri modeli | H | 05, 07 |
| 18 | SOS ingest, idempotency ve doğrulama | H | 09, 17 |
| 19 | Gateway senkronizasyonu ve gerçek zamanlı yayın | H | 16, 18 |
| 20 | Meta AI servis entegrasyonu | H | 18 |
| 21 | Koordinasyon paneli temeli ve güvenli oturum | H | 04, 17, 19 |
| 22 | Harita, filtreleme ve canlı SOS listesi | H | 19, 21 |
| 23 | Vaka ayrıntısı, AI önerisi ve operatör eylemleri | H | 20, 21, 22 |
| 24 | M0 gerçek cihaz uçtan uca senaryo | H | 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23 |
| 25 | Hackathon sunumu ve yedek demo | H | 24 |
| 26 | Kapsamlı web tasarım sistemi ve çoklu organizasyon | P | 21, 22, 23 |
| 27 | Ekip, kaynak ve görev yönetimi | P | 23, 26 |
| 28 | Bildirim, abonelik ve işlem geçmişi | P | 27 |
| 29 | Android tasarım polish ve gelişmiş akışlar | P | 13, 14, 15, 16 |
| 30 | Android ağ/OS durum makinesi ve pil profili | P | 16, 29 |
| 31 | iOS SwiftUI uygulama iskeleti ve ilk açılış | P | 04, 07, 09, 10 |
| 32 | iOS Core Bluetooth central/peripheral iletişim | P | 15, 31 |
| 33 | iOS arka plan ve state restoration testleri | P | 32 |
| 34 | iOS ↔ Android çapraz entegrasyon ve hata UX | P | 31, 32, 33, 18 |
| 35 | Wear OS companion proje ve tek dokunuş SOS | P | 13, 29 |
| 36 | Wear OS durum senkronu ve offline queue | P | 35 |
| 37 | Apple Watch SwiftUI ve Watch Connectivity | P | 31, 34 |
| 38 | Apple Watch komplikasyonları ve yeniden deneme | P | 37 |
| 39 | Saat bağlantısı olmayan kullanım deneyimi | P | 36, 38 |
| 40 | Çok atlamalı Android mesh v2 | P | 15, 16, 34 |
| 41 | Çok atlamalı iOS uyumluluk araştırması | E | 33, 40 |
| 42 | Gelişmiş radyo planlayıcı ve pil optimizasyonu | P | 30, 33, 40 |
| 43 | Güvenlik tehdit modeli ve bağımsız denetim | P | 09, 18, 34, 40 |
| 44 | Veri mahremiyeti, rıza ve saklama | P | 43 |
| 45 | Meta AI değerlendirme ve maliyet sınırı | P | 20, 23, 44 |
| 46 | AI yardım planlama taslakları ve kaynak eşleştirme | P | 27, 45 |
| 47 | Performans, yük ve dayanıklılık | P | 19, 40, 45 |
| 48 | Gözlemlenebilirlik, incident runbooks ve audit | P | 17, 18, 19, 20, 21, 22, 23, 47 |
| 49 | Yedekleme, veri kurtarma ve güvenli güncelleme | P | 47, 48 |
| 50 | Web güvenlik, erişilebilirlik ve responsive kapanış | P | 26, 27, 28, 43 |
| 51 | Android gerçek cihaz yayın kapısı | P | 29, 30, 40, 43, 50 |
| 52 | iOS / watchOS gerçek cihaz ve TestFlight kapısı | P | 34, 37, 38, 39, 43 |
| 53 | Wear OS gerçek cihaz ve Play release kapısı | P | 36, 39, 43 |
| 54 | Backend deployment ve environment yönetimi | P | 49, 51, 52, 53 |
| 55 | Pilot kullanıcı testi ve saha güvenilirliği | P | 51, 52, 53, 54 |
| 56 | Hata düzeltme, regresyon ve sürüm dondurma | P | 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55 |
| 57 | Kullanıcı belgeleri ve açık destek sınırları | P | 44, 55, 56 |
| 58 | Operasyonel handover ve tamamlanma raporu | P | 56, 57 |
