# SOSMesh — Risk Kaydı

**Versiyon:** 1.0  
**Tarih:** 2026-10-29  
**Kapsam:** M0 + izlenebilir riskler

---

## Risk Değerlendirme Ölçeği

**Olasılık:**
- **Y (Yüksek):** %60+ — sık karşılaşılır
- **O (Orta):** %20–60% — zaman zaman görülür
- **D (Düşük):** <%20 — nadir

**Etki:**
- **K (Kritik):** Sistem kullanılamaz / fiziksel güvenlik riski / yasal sorun
- **Y (Yüksek):** Temel işlev çalışmaz / kullanıcı güveni zarar görür
- **O (Orta):** Performans/deneyim kötüleşir
- **D (Düşük):** Küçük rahatsızlık

---

## Risk Tablosu

| ID | Risk | Olasılık | Etki | Risk Puanı | Azaltma Stratejisi | Sahip | İlgili ADIM | Durum |
|----|------|----------|------|-----------|-------------------|-------|-------------|-------|
| **R-01** | **Yanlış güven/yanlış başarı etiketi** — Kullanıcı "PEER_RECEIVED" gördüğünde "sunucuya ulaştı" sanıyor | O | Y | **Orta-Yüksek** | YASAK etiket listesi; UI metinlerinde açık durum adları ("Yakındaki cihaza aktarıldı" vs "Sunucuya ulaştı"); her durum geçişi doğrulanmış ACK ile; onboarding'de durum açıklamaları | ADIM 04 (UX), ADIM 13 (Android UI) | 04, 13, 21 | OPEN |
| **R-02** | **BLE güvenilirliği** — Android OEM farklılıkları, iOS background sınırları, mesh transfer %100 garanti edilmez | Y | Y | **Yüksek-Yüksek** | Test matrisi (ADIM 30, 33); kullanıcıya "best-effort" açıklaması; foreground service notification (Android); iOS kısıtları README/onboarding'de belirtilir; simülatör PASS ≠ gerçek BLE PASS | ADIM 14 (BLE), ADIM 30 (Android matrix), ADIM 33 (iOS matrix) | 14, 15, 16, 30, 32, 33 | OPEN |
| **R-03** | **iOS background sınırı** — iPhone force-quit sonrası relay çalışmaz; kullanıcı "7/24 relay" beklentisi | Y | O | **Yüksek-Orta** | Onboarding: "iPhone arka planda sınırlı relay; force-quit sonrası durur"; ADIM 33'te test matrisi; desteklenen senaryolar belgeli; yanlış garanti yok | ADIM 33 (iOS background), ADIM 34 (cross-platform) | 31, 33, 34 | OPEN |
| **R-04** | **Sahte vaka/kötüye kullanım** — Kötü niyetli kullanıcı sahte SOS flood yapar | O | Y | **Orta-Yüksek** | Rate limit (IP/cihaz bazlı); anomali tespiti (aynı cihaz 1 dk'da >10 SOS); insan review; actor reputation (gelecek); abuse report mekanizması; imzalı payload (ADIM 09) | ADIM 18 (ingest validation), ADIM 43 (security) | 18, 43 | OPEN |
| **R-05** | **PII/konum sızıntısı** — Şifrelenmemiş röle yolu, log'da payload, debug modda koordinat | O | K | **Orta-Kritik** | End-to-end encryption (ADIM 09); röle payload görmez; log redaction (ADIM 48); prod'da debug log kapalı; audit trail (ADIM 48); KVKK uyumluluk taslak (ADIM 44) | ADIM 09 (crypto), ADIM 44 (privacy), ADIM 48 (logging) | 09, 15, 44, 48 | OPEN |
| **R-06** | **Meta veri işleme/şartlar** — Meta AI API veri saklama/kullanım şartları belirsiz; hassas SOS içeriği Meta'ya gidiyor | Y | Y | **Yüksek-Yüksek** | Meta veri politikası inceleme; de-identify prompt (mümkünse); contributor model yerine server-only API; gerçek SOS'ları prod'a göndermeden önce veri işleme sözleşmesi; alternatif lokal model (ADIM 45'te değerlendirme) | ADIM 20 (AI integration), ADIM 45 (AI eval) | 20, 44, 45 | OPEN |
| **R-07** | **AI halüsinasyonu** — Model açıkça söylenmeyeni uydurur (konum, kişi, yaralanma); operatör yanlış bilgiye dayanır | O | Y | **Orta-Yüksek** | Prompt: "Açıkça söylenmeyenleri UYDURMA"; JSON Schema validation; `uncertainty` bayrağı; `quoted_evidence` alanı; operatör UI'da "AI önerisi, doğrulanmadı" notu; manuel override zorunlu; eval dataset (≥100 Türkçe/İngilizce fixture, ADIM 45) | ADIM 20 (AI), ADIM 45 (eval) | 20, 45 | OPEN |
| **R-08** | **Pil tüketimi (relay modu)** — Gönüllü relay modu bataryayı hızla tüketir; kullanıcı şikayetçi olur | O | O | **Orta-Orta** | Kullanıcı opt-in; pil eşiği (ör. %20 altında otomatik durdur); duty cycle (scan interval optimize); foreground notification "Relay aktif, pil ~X% etki"; kullanıcı istediği zaman durdurabilir; enerji profil ölçümü (ADIM 42) | ADIM 16 (relay), ADIM 30 (Android), ADIM 42 (power optimize) | 16, 30, 42 | OPEN |
| **R-09** | **Cihaz erişimi blokajı — B-02** — Gerçek BLE testi için 2 fiziksel Android yok; M0 kanıtlanamaz | Y | K | **Yüksek-Kritik** | Kullanıcıdan 2 Android telefon (BLE 5, Android 12+, USB debug) sağlanması; alternatif: Cursor cloud agent Mac'te ADB ile bağlı cihazlar; simülatör ADIM 11'de kullanılır ama M0 PASS sayılmaz | ADIM 01 (envanter), ADIM 12 (Android) | 12, 14, 15, 24 | **BLOCKED_DEVICE** |
| **R-10** | **Cihaz erişimi blokajı — B-03** — iPhone'lar OFFLINE; iOS testleri yapılamıyor | O | O | **Orta-Orta** | M0'da iOS hariç; M1'de kullanıcıdan iPhone kablo/Wi-Fi bağlantısı + güven; ADIM 31+ başlamadan çözülmeli | ADIM 01 (envanter), ADIM 31 (iOS) | 31, 32, 34 | **BLOCKED_DEVICE** (M1) |
| **R-11** | **Secret blokajı — B-05** — Sunucu tarafı Meta API anahtarı (adı ADIM 20'de ADR ile kesinleşir) doğrulanmadı; Meta AI adımı test edilemiyor | Y | O | **Yüksek-Orta** | Mock Meta provider (ADIM 20); anahtar yoksa AI adımı BLOCKED_SECRET, ham vaka kaybolmaz; M0 "tam" kabul edilmez ama kısmi demo mümkün; kullanıcıdan prod anahtarı secret manager ile | ADIM 01 (envanter), ADIM 20 (AI) | 20, 24 | **BLOCKED_SECRET** |
| **R-12** | **Demo'nun gerçek sanılması** — Kullanıcı/jüri simülasyonu gerçek operasyon sanır; yanlış değerlendirme | O | Y | **Orta-Yüksek** | Her ekranda "DEMO — GERÇEK DEĞİL" etiketi; simülasyon verisi "Simülasyon" notu ile; README/sunumda açık belirtme; gerçek test videosu ile demo ayrı gösterilir; ADIM 25'te submission checklist | ADIM 04 (UX), ADIM 25 (hackathon) | 04, 13, 21, 25 | OPEN |
| **R-13** | **İnternet olmadan Meta çağrısı** — Offline yolda A→B BLE sırasında Meta API'ye bağlanma denemesi; gecikme/hata | D | O | **Düşük-Orta** | Kritik yol: yalnızca B cihazı internet varsa upload yapar; A cihazı offline ise **hiçbir HTTP istemi** yapmaz; negatif test (@M0 @negative) bu senaryoyu doğrular | ADIM 16 (relay), ADIM 19 (sync), ADIM 20 (AI) | 16, 19, 20 | OPEN |
| **R-14** | **Duplicate paket çoğalması** — Aynı SOS 3 röleden gelse veritabanı şişer | O | O | **Orta-Orta** | Idempotency: `message_id` UNIQUE constraint; relay receipt ayrı tablo; duplicate POST 2xx döner ama kayıt oluşturmaz; integration test (ADIM 18) | ADIM 18 (ingest) | 18 | OPEN |
| **R-15** | **RBAC bypass** — Yetkisiz kullanıcı vaka detaylarını görür; gizlilik ihlali | D | K | **Düşük-Kritik** | Server-side RBAC her endpoint'te; role guard (ADIM 21); route authorization test (ADIM 50); audit log (ADIM 48); session hijacking önleme | ADIM 21 (panel auth), ADIM 50 (web security) | 21, 50 | OPEN |
| **R-16** | **CI bypass — sahte test PASS** — Grok skip edilmiş testi başarı sayar; kalite düşer | O | Y | **Orta-Yüksek** | CI kilidi: skip test = fail; branch protection (ADIM 06); test artifact yayınlanır; coverage raporu; flakiness ölçümü; Grok kanıt olmadan PASS vermez | ADIM 06 (CI/CD) | 06 | OPEN |
| **R-17** | **Operatör AI'ya körü körüne güvenir** — AI "yüksek aciliyet" der, operatör sorgulamaz; yanlış önceliklendirme | O | Y | **Orta-Yüksek** | UI'da AI çıktısı **"Öneri"** başlığı; **"Karar"** değil; belirsizlik (`uncertainty: true`) vurgulanır; manuel override zorunlu (otomasyon yok); operatör eğitimi (ADIM 57'de dokümante) | ADIM 20 (AI), ADIM 23 (operatör UI), ADIM 45 (eval) | 20, 23, 45, 57 | OPEN |
| **R-18** | **Bütçe/harcama aşımı — B-07** — Meta AI çağrı maliyeti, cloud agent harcama kontrolsüz | O | O | **Orta-Orta** | Kullanıcı bütçe limiti onayı (B-07 çözülmeli); per-incident token budget; rate limit; AI disabled mode; spend cap (ADIM 45); maliyet monitoring | ADIM 01 (envanter), ADIM 20 (AI), ADIM 45 (cost limit) | 20, 45 | **BLOCKED_APPROVAL** |
| **R-19** | **Yasal uyumsuzluk (KVKK/GDPR)** — Konum/sağlık verisi izinsiz saklanır; ceza | D | K | **Düşük-Kritik** | Privacy-by-design (ADIM 44); kullanıcı rıza metni (onboarding); retention policy; delete/export request; avukat incelemesi (ADIM 44'te taslak, prod önce zorunlu) | ADIM 44 (privacy) | 44, 57 | OPEN (M1 sonrası) |
| **R-20** | **Saat bağımsız mesh iddiası** — Kullanıcı "Apple Watch tek başına mesh" bekler; teknik olarak imkansız | O | O | **Orta-Orta** | Onboarding: "Saatler yalnızca eşleşmiş telefona SOS gönderir"; ADIM 39'da capability matrix; LTE/Wi-Fi direct ingest **deneysel** (flag ile); "telefon olmadan mesh relay" iddiası **kapsam dışı** | ADIM 37 (Apple Watch), ADIM 39 (capability) | 37, 39 | OPEN (M1 sonrası) |

---

## Risk Özeti

| Risk Puanı | Sayı | ID'ler |
|-----------|------|--------|
| Kritik | 3 | R-05 (PII sızıntısı), R-09 (Android cihaz yok), R-15 (RBAC), R-19 (yasal) |
| Yüksek | 6 | R-01 (yanlış etiket), R-02 (BLE güvenilirlik), R-04 (sahte vaka), R-06 (Meta veri), R-07 (AI halüsinasyon), R-17 (AI körü körüne güven) |
| Orta | 11 | Geri kalan |

---

## Acil Müdahale Gerektiren Riskler (ADIM 02 sonrası)

1. **R-09 (BLOCKED_DEVICE):** 2 Android telefon temin edilmeli; yoksa M0 fiziksel testi yapılamaz.
2. **R-11 (BLOCKED_SECRET):** Meta API anahtarı doğrulanmalı; yoksa AI adımı PASS sayılmaz.
3. **R-01 (Yanlış etiket):** ADIM 04 UX'te YASAK etiket listesi uygulanmalı; jüri/kullanıcı yanıltma riski.
4. **R-05 (PII sızıntısı):** ADIM 09 crypto başlamadan log/debug hijyeni kuralları koyulmalı.

---

## Sonraki İncelemeler

- **ADIM 06:** CI/CD iskelet kurulunca R-16 test edilir.
- **ADIM 24:** M0 fiziksel test sonrası R-02, R-09, R-11 durumu güncellenir.
- **ADIM 43:** Güvenlik audit'te R-04, R-05, R-15 penetrasyon testi yapılır.
- **ADIM 44:** Privacy audit'te R-06, R-19 yasal inceleme yapılır.

---

**Not:** Risk kaydı canlı dokümandır; her ADIM'da güncellenir. Yeni risk bulunursa ID sırasıyla eklenir (R-21, R-22...).
