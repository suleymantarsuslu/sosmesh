# SOSMesh — Ürün Gereksinimleri Dokümanı (PRD)

**Versiyon:** 1.0  
**Tarih:** 2026-10-29  
**Durum:** ADIM 02 (M0 kapsamı)

---

## 1. Hedef

SOSMesh, internet altyapısının çöktüğü veya olmadığı acil durumlarda (deprem, sel, yangın vb.), mobil cihazlar arası Bluetooth Low Energy (BLE) mesh ağı üzerinden SOS mesajlarını yakındaki gönüllü rölelere, oradan internete ve koordinasyon paneline taşıyan **deneysel** bir acil durum haberleşme sistemidir.

**KRİTİK UYARI:** Bu sistem **Türkiye'de 112 resmî acil çağrı hizmetinin yerine geçmez**. Fiziksel kurtarma garantisi vermez. Yalnızca mesaj aktarım denemesidir.

---

## 2. Kapsam Dışı (Kesin Sınırlar)

### 2.1 Resmî Entegrasyon ve Garanti YOK

- ❌ **112/resmî kurumlarla entegrasyon yok:** Sisteme gelen SOS'lar resmî acil servislere otomatik iletilmez.
- ❌ **Fiziksel kurtarma garantisi yok:** Koordinasyon paneli operatörü, sistem yalnızca bilgi sunar; gerçek müdahale/görevlendirme bu sistemin sorumluluğu değildir.
- ❌ **Yasal güvence yok:** KVKK/GDPR uyumluluğu taslak; üretim yasal inceleme gerektirir.

### 2.2 Cihaz ve OS Sınırlamaları (Abartılmayan Gerçeklik)

- ❌ **iOS arka plan mesh relay garantisi yok:** iPhone force-quit sonrası veya arka planda BLE relay çalışma garantisi yoktur; yalnızca test edilen kombinasyonlar destek listesinde olacak.
- ❌ **Apple Watch/Wear OS bağımsız mesh relay yok:** Saatler yalnızca eşleşmiş telefona SOS gönderir; telefon olmadan başka cihaza mesh relay iddiası **kapsam dışı**.
- ❌ **Android background sürekli garanti yok:** OEM kısıtlamaları (Doze, pil tasarrufu, izin) relay'i durdurabilir; kullanıcıya açıkça bildirilir.

### 2.3 AI ve Otomasyon Sınırları

- ❌ **AI özerk karar vermez:** Meta AI yalnızca sınıflandırma/öneri sunar; triyaj, tedavi önceliklendirme, ekip görevlendirme **insan onayı gerektirir**.
- ❌ **AI halüsinasyon risk kabul:** Model açıkça söylenmeyen bilgileri uydurabilir; belirsizlik bayrakları ve operatör override zorunlu.

### 2.4 Demo/Simülasyon Şeffaflığı

- ❌ **Simülatör başarısı gerçek BLE başarısı sayılmaz:** ADIM 11'deki radyo simülatörü PASS, gerçek cihaz testini atlamaz.
- ❌ **Mock/demo modu açıkça etiketli:** Kullanıcı demo'yu gerçek operasyon sanmamalı.

---

## 3. Roller ve Sorumluluklar

### 3.1 Afetzede (SOS Gönderen)

- **İzinler:** Bluetooth, konum (opsiyonel), bildirim.
- **Eylemler:** SOS oluştur (tür, kişi sayısı, kısa not, konum); durumu izle.
- **Göremez:** Röle cihaz sayısı, röle detayları, operatör kimliği.
- **Garantisi:** Yalnızca cihazında kaydoldu/yakın cihaza aktarıldı/sunucuya ulaştı/operatör gördü ayrımı; **fiziksel yardım garantisi yok**.

### 3.2 Gönüllü Röle

- **İzinler:** Bluetooth, konum (opsiyonel), bildirim, internet.
- **Opt-in:** Kullanıcı açıkça relay modunu aktifleştirir; pil eşiği ve veri limiti bildirilir.
- **Göremez:** **SOS mesaj içeriğini görmez** (şifreli payload); yalnızca "X paket bekliyor, Y KB" görür.
- **Kısıtlar:** OS/pil kısıtlamaları nedeniyle aktarım garanti edilmez; kullanıcıya açıklanır.

### 3.3 Operatör (Koordinasyon Paneli)

- **İzinler:** RBAC ile vaka görme/düzenleme/atama yetkisi.
- **Eylemler:** SOS detaylarını görür, AI önerisini değerlendirir, durum günceller, manuel override yapar.
- **Göremez:** Şifrelenmemiş röle yolu (privacy); yalnızca son hop timestamp'leri.
- **Sorumluluğu:** Gerçek müdahale bu sistem dışında koordine edilir; sistem yalnızca bilgi sunar.

### 3.4 Admin

- **İzinler:** Kullanıcı/ekip/rol yönetimi, sistem ayarları, audit log erişimi.
- **Kısıtlar:** Prod secret/key rotation kullanıcı onayı gerektirir.

---

## 4. Beş SOS Durumu ve ACK Eşlemesi

### 4.1 Durum Diyagramı (Zorunlu Sıra)

```
CİHAZDA KAYITLI
    ↓ (BLE peer ack)
YAKIN CİHAZA AKTARILDI (PEER_RECEIVED)
    ↓ (HTTP 2xx + server receipt)
SUNUCUYA ULAŞTI (SERVER_ACCEPTED)
    ↓ (operatör panelde açar)
OPERATÖR GÖRDÜ (OPERATOR_SEEN)
    ↓ (operatör "inceleme/koordinasyon" atar)
VAKA İŞLEME ALINDI (CASE_IN_PROGRESS)
```

### 4.2 ACK Eşlemesi

| Durum Adı | ACK Kod | Kaynak | UI Metni (TR) | UI Metni (EN) |
|-----------|---------|--------|---------------|---------------|
| CİHAZDA KAYITLI | — | Cihaz local queue | "Mesajınız cihazınızda kaydedildi, yakındaki cihaz aranıyor" | "Message saved locally, searching for nearby device" |
| YAKIN CİHAZA AKTARILDI | `PEER_RECEIVED` | BLE peer signed ack | "Yakındaki bir cihaz aldı, internete ulaşması bekleniyor" | "Received by nearby device, waiting for internet" |
| SUNUCUYA ULAŞTI | `SERVER_ACCEPTED` | API POST receipt | "Sunucuya ulaştı, operatör paneline düştü" | "Reached server, visible to operators" |
| OPERATÖR GÖRDÜ | `OPERATOR_SEEN` | Panel open event | "Operatör gördü" | "Operator viewed" |
| VAKA İŞLEME ALINDI | `CASE_IN_PROGRESS` | Manuel durum | "Vaka işlemde" | "Case in progress" |

### 4.3 YASAK Etiket Listesi (Asla Kullanılmaz)

Aşağıdaki ifadeler **hiçbir UI/bildirimde/dokümantasyonda kanıtsız kullanılmaz**:

| YASAK İfade | Neden Yasak |
|-------------|-------------|
| "Gönderildi" | Belirsiz; hangi adıma ulaştı? PEER mi SERVER mi? |
| "Teslim edildi" | Fiziksel teslim garantisi varmış gibi; yanlış. |
| "Okundu" / "Görüldü" | OPERATOR_SEEN haricinde kanıtsız. |
| "Ekip yolda" / "Yardım geliyor" | Fiziksel müdahale bu sistemin garantisi değil. |
| "Güvendesiniz" | Yanlış güvence; sistem yalnızca mesaj taşır. |
| "Başarıyla iletildi" | Hangi adıma? SERVER mi OPERATOR mi? |
| "Aktif bağlantı" (BLE için) | BLE geçici; "bağlantı" terimi TCP gibi kalıcı sanısı verir. |
| "Garantili teslimat" | Hiçbir adım garanti değil; mesh best-effort. |

**Kural:** Her durum adı ve UI metni **doğrulanmış ACK event**'e dayanmalı; tahmin/varsayım yasak.

---

## 5. M0 vs M1 vs Tam Ürün (Ölçülebilir Kapsam)

### 5.1 M0 (Hackathon Çekirdeği) — Demo Kapsamı

**Hedef:** Tek yönlü Android A (offline) → Android B (online) → API → Panel → Meta AI akışını **2 fiziksel Android** ile kanıtla.

**Dahil:**
- ✅ Android SOS ekranı (tür, kişi, not, GPS)
- ✅ BLE peer discovery + data transfer (A→B)
- ✅ A cihazında PEER_RECEIVED durumu (B'nin imzalı ack'ı ile)
- ✅ B cihazında upload job (HTTP retry)
- ✅ API `/v1/ingest` + idempotency (duplicate→tek kayıt)
- ✅ Meta AI sınıflandırma (mock fallback ile; anahtar yoksa BLOCKED_SECRET)
- ✅ Panel canlı feed (SSE/WebSocket)
- ✅ Operatör vaka detayını açar → OPERATOR_SEEN
- ✅ Negatif senaryolar (internetsiz Meta çağrısı yok, izin reddi, BT kapalı)

**Hariç (M1'e ertelendi):**
- ❌ iOS/watchOS (ADIM 31–39)
- ❌ Çok atlamalı mesh (A→B→C) (ADIM 40)
- ❌ Röle UI (ADIM 16'da basit gösterge, tam polish ADIM 29)
- ❌ Ekip atama/görev yönetimi (ADIM 27)
- ❌ Güvenlik audit (ADIM 43)

**Kabul Kriteri:** Bağımsız gözlemci, 2 Android + API + panel ile M0 senaryosunu **gerçek cihazlarla** tekrar edebilir; simülatör değil.

### 5.2 M1 (Hackathon Artı) — Yarışma Sonrası İyileştirme

**Ekler:**
- ✅ iOS/watchOS temel (ADIM 31, 37)
- ✅ Android polish (ADIM 29)
- ✅ Çok atlamalı mesh v2 (3 Android) (ADIM 40)
- ✅ Panel tasarım sistemi (ADIM 26)

**Hariç (Tam ürüne ertelendi):**
- ❌ Production deployment (ADIM 54)
- ❌ Pilot test (ADIM 55)
- ❌ Güvenlik/privacy audit (ADIM 43–44)

### 5.3 Tam Ürün (ADIM 01–58)

**Ekler:**
- ✅ Güvenlik audit + STRIDE (ADIM 43)
- ✅ Privacy/KVKK uyumluluk taslak (ADIM 44)
- ✅ Production deploy (ADIM 54)
- ✅ Pilot kullanıcı testi (ADIM 55)
- ✅ Performans/yük testleri (ADIM 47)
- ✅ Release kapısı (ADIM 56)

**Not:** Tam ürün bile **resmî 112 entegrasyonu** ve **fiziksel kurtarma garantisi** içermez.

---

## 6. U1–U5 Kullanım Senaryoları (BDD Uyumlu)

### U1: Afetzede offline SOS gönderimi
**Aktör:** Afetzede  
**Ön Koşul:** Mobil veri/Wi-Fi kapalı, BLE açık, konum izni verilmiş  
**Akış:**
1. Ana ekrandan "SOS" butonuna basar
2. Acil durum türünü seçer (yangın/deprem/sel/yaralanma/diğer)
3. Kişi sayısı girer (1–99 veya "bilinmiyor")
4. Kısa not yazar (maks 200 karakter, opsiyonel)
5. GPS konum otomatik alınır; izin yoksa "konum bilinmiyor" olarak işaretlenir
6. "Gönder" butonuna basar
7. SOS local queue'ya kaydedilir, durum "CİHAZDA KAYITLI"
8. BLE scan başlar, yakın cihaz arar

**Sonuç:** SOS hiçbir zaman kaybolmaz; cihaz kapansa bile reboot'ta queue'da kalır.

### U2: Gönüllü röle aktarımı
**Aktör:** Gönüllü röle (internet olan cihaz)  
**Ön Koşul:** Kullanıcı relay modunu opt-in ile aktifleştirmiş, BLE+internet açık  
**Akış:**
1. Uygulama arka planda BLE scan yapar (duty cycle ile)
2. Yakında afetzede cihazı tespit eder (service UUID match)
3. GATT bağlantı kurar, SOS envelope'unu chunk olarak alır
4. Her chunk'ı doğrular (CRC), ACK gönderir
5. Tam envelope alındığında SHA digest doğrular
6. Röle cihazında **şifreli payload'u outbox'a yazar** (içeriği görmez)
7. İnternet varsa hemen, yoksa bağlantı gelince `/v1/ingest` POST yapar
8. Server receipt (SERVER_ACCEPTED) alınca afetzede cihazına BLE ile bildirir

**Sonuç:** Afetzede cihazında durum "YAKIN CİHAZA AKTARILDI" → "SUNUCUYA ULAŞTI" olur.

### U3: Operatör koordinasyon ve AI yardımı
**Aktör:** Operatör (koordinasyon paneli) + Backend AI worker (destekleyici)  
**Ön Koşul:** Panel açık, yetkili rol, canlı feed bağlı; sunucu tarafı Meta API anahtarı yapılandırılmış (opsiyonel)  
**Akış:**
1. Yeni SOS panelde canlı feed'de belirir (SSE event)
2. Operatör vakayı listeden seçip açar
3. Sistem "OPERATOR_SEEN" event kaydeder, timestamp yazar
4. Operatör orijinal mesaj, GPS, zaman damgası görür
5. **AI Destekleyici Sınıflandırma (Opsiyonel):**
   - Backend AI worker `/v1/ingest` sonrası SOS'u queue'dan alır
   - Yapılandırılmış Meta model kimliği ile prompt gönderir: "Aşağıdaki acil durum metnini sınıflandır; açıkça söylenmeyenleri UYDURMA"
   - AI cevabı JSON Schema ile validate edilir: `categories[]`, `persons_estimate`, `injuries_reported`, `needs[]`, `urgency_suggestion`, `uncertainty`, `quoted_evidence`, `location_unknown`, `language`
   - Belirsizlik bayrakları (`uncertainty`, `location_unknown`) kontrol edilir
   - AI çıktısı `ai_analyses` tablosuna yazılır, vaka ile ilişkilendirilir
   - **AI başarısız olursa (timeout/429/5xx/anahtar yok):** Ham vaka kaybolmaz, AI alanı null kalır, operatör ham metni görür
6. Operatör panelde AI önerisi **"Öneri"** başlığı altında görür (**"Karar"** değil; özerk karar yok)
7. Operatör gerekirse manuel override yapar (konum/kişi düzeltme)
8. Durum "VAKA İŞLEME ALINDI" olarak günceller

**Sonuç:** Afetzede uygulamasında "OPERATÖR GÖRDÜ" görünür; operatör tarafında audit log tutuluyor. AI yalnızca destekleyici bilgi; gerçek karar insan operatörde.

### U4: Saat (Watch) SOS — Companion telefon üzerinden
**Aktör:** Afetzede (Wear OS veya Apple Watch kullanıcısı)  
**Ön Koşul:** Saat, eşleşmiş telefon ile Bluetooth companion bağlantısı var; telefon uygulaması arka planda  
**Kapsam:** **Post-M0 (M1 veya sonrası)**; M0 yalnızca Android telefon odaklı  
**Akış:**
1. Kullanıcı saatte "SOS" butonuna basar
2. Basit menüden acil durum türü seçer (deprem/yangın/yaralanma)
3. Saat, SOS'u Bluetooth companion API (Wear OS: Data Layer API, watchOS: WatchConnectivity) ile telefona aktarır
4. Telefon uygulaması SOS'u kendi offline queue'suna ekler
5. Saatte UI: "Telefona aktarıldı, telefon aracılığıyla işlenecek"
6. **Telefon erişilemezse (kapalı/menzil dışı):** Saat SOS'u yerel belleğe yazar, "Telefona ulaşılamıyor; telefon açıldığında aktarılacak" gösterir
7. **Saat bağımsız mesh rölesi DEĞİLDİR:** Röle modu seçeneği görünmez; saat başka cihazlardan BLE SOS paketlerini almaz/iletmez

**Sonuç:** Saat yalnızca companion telefon aracılığıyla SOS gönderir; ağ erişimi/mesh relay telefon sorumluluğunda.

### U5: Negatif senaryo — İzin reddi ve offline yolu
**Aktör:** Afetzede  
**Ön Koşul:** Konum izni reddedilmiş, BT izni verilmiş  
**Akış:**
1. SOS oluşturma ekranında GPS okumaya çalışır
2. İzin yok uyarısı gösterir: "Konum izni verilmedi; 'konum bilinmiyor' olarak kaydedilecek"
3. Kullanıcı devam eder
4. SOS `location: null` ile kaydedilir
5. BLE aktarım normal çalışır
6. Panelde konum "Bilinmiyor" görünür, haritada pin yok
7. **Offline yolu testi:** A cihazı internetsiz → Meta API'ye hiçbir ağ çağrısı yapılmaz; yalnızca B cihazı upload yapar

**Sonuç:** İzin olmadan sistem kullanılabilir; yanlış "konum alındı" iddiası yok.

---

## 7. Kritik Kırmızı Çizgiler (Asla İhlal Edilmez)

### 7.1 112 Yerine Geçmez
- Onboarding'de ve her SOS ekranında **"Bu uygulama 112'nin yerine geçmez; gerçek acil durumda 112'yi arayın"** metni zorunlu.
- Demo/simülasyon modunda **"DEMO — GERÇEK DEĞİL"** etiketi her ekranda.

### 7.2 AI Özerk Karar Vermez
- AI çıktısı **"Öneri"** başlığı altında; **"Karar"** veya **"Sonuç"** denmez.
- Ekip görevlendirme, triyaj önceliklendirme, tedavi önerisi **insan onayı gerektirir**.
- AI belirsizlik bayrağı (`uncertainty: true`) UI'da açıkça gösterilir.

### 7.3 Röle SOS İçeriğini Görmez
- Payload şifreli; röle yalnızca "X paket, Y KB, pil etkisi ~Z%" görür.
- Decrypt yalnızca server'da; röle UI'da metin/konum/kişi bilgisi asla gösterilmez.

### 7.4 Yanlış Başarı Etiketi Yasak
- "PEER_RECEIVED" → UI: "Yakındaki cihaza aktarıldı" ✅; "Sunucuya ulaştı" ❌
- "SERVER_ACCEPTED" → UI: "Sunucuya ulaştı" ✅; "Okundu" ❌
- "OPERATOR_SEEN" → UI: "Operatör gördü" ✅; "Yardım yolda" ❌

---

## 8. Kabul Kriterleri (ADIM 02)

### 8.1 Ölçülebilir Demo Kapsamı

- ✅ M0 senaryosu (A→B→API→Panel→Meta) **2 fiziksel Android** ile doğrulanabilir
- ✅ U1–U5 her biri ≥1 BDD senaryo ile yazılı
- ✅ ≥5 negatif senaryo (@negative etiketi ile)
- ✅ YASAK etiket listesi PRD'de; feature/onboarding dosyalarında yalnızca "asla kullanma" bağlamında geçer

### 8.2 Kırmızı Çizgiler Yazılı

- ✅ 112 uyarısı PRD + onboarding'de
- ✅ AI otorite değil, destekleyici
- ✅ Röle gizliliği (payload görmez)
- ✅ iOS/saat/background garantisi yok açıklaması

### 8.3 İzlenebilirlik

- ✅ Senaryo → ADIM → kanıt türü eşlemesi (`docs/tests/traceability.md`)
- ✅ Kapsanmayan gereksinim yok veya "kapsam dışı" işaretli

---

## 9. Sonraki Adımlar

- **ADIM 03:** Mimari ADR (Next.js/NestJS/Kotlin/SwiftUI seçimi)
- **ADIM 04:** UX tasarım sistemi (design tokens, wireflows)
- **ADIM 05:** Monorepo iskelet (workspace, Docker Compose, bootstrap)

**Not:** ADIM 02 sonunda kod yok; yalnızca doküman. Kod ADIM 05'te başlar.
