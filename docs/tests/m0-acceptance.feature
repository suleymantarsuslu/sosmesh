# language: tr

Özellik: SOSMesh M0 Kabul Testleri
  Acil durum mesh ağı sisteminin temel çalışma senaryoları.
  M0 kapsamı: Android A (offline) → Android B (online) → API → Panel → Meta AI

  Arka Plan:
    Varsayalım ki sistem ayakta ve sağlıklı
    Ve API "/health" endpoint'i 200 dönüyor
    Ve Meta AI servisi erişilebilir (yoksa BLOCKED_SECRET)

  @U1 @device-required
  Senaryo: Afetzede offline SOS oluşturur
    Diyelim ki Android A cihazında mobil veri ve Wi-Fi kapalı
    Ve Android A'da Bluetooth açık
    Ve konum izni verilmiş
    Ve uygulama açık
    Eğer kullanıcı "SOS" butonuna basarsa
    Ve acil durum türü olarak "Deprem" seçerse
    Ve kişi sayısı olarak "3" girerse
    Ve not olarak "Bina çöktü, 2. kat" yazarsa
    Ve "Gönder" butonuna basarsa
    O zaman SOS cihazda kaydedilir
    Ve durum "CİHAZDA KAYITLI" olur
    Ve BLE scan başlar
    Ve UI "Mesajınız cihazınızda kaydedildi, yakındaki cihaz aranıyor" gösterir

  @U1 @device-required @negative
  Senaryo: Konum izni olmadan SOS oluşturma
    Diyelim ki Android A cihazında konum izni reddedilmiş
    Ve Bluetooth izni verilmiş
    Ve uygulama açık
    Eğer kullanıcı "SOS" butonuna basarsa
    Ve acil durum türü olarak "Yangın" seçerse
    Ve "Gönder" butonuna basarsa
    O zaman SOS "location: null" ile kaydedilir
    Ve durum "CİHAZDA KAYITLI" olur
    Ve UI "Konum izni verilmedi; 'konum bilinmiyor' olarak kaydedilecek" uyarısı gösterir
    Ve UI **asla** "Konumunuz alındı" demez

  @U2 @device-required
  Senaryo: Gönüllü röle BLE ile SOS alır
    Diyelim ki Android A'da offline SOS oluşturulmuş
    Ve Android B cihazında relay modu aktif
    Ve Android B'de Bluetooth ve internet açık
    Ve iki cihaz 10 metre mesafede
    Eğer Android B, Android A'yı BLE scan ile tespit ederse
    Ve GATT bağlantı kurarsa
    Ve SOS envelope'unu chunk olarak alırsa
    O zaman Android B her chunk'ı CRC ile doğrular
    Ve her chunk için ACK gönderir
    Ve tam envelope alındığında SHA digest doğrular
    Ve imzalı PEER_RECEIVED ack'ını Android A'ya gönderir
    Ve Android A'da durum "YAKIN CİHAZA AKTARILDI" olur
    Ve Android A UI "Yakındaki bir cihaz aldı, internete ulaşması bekleniyor" gösterir
    Ve Android A UI **asla** "Sunucuya ulaştı" veya "Okundu" demez

  @U2 @device-required
  Senaryo: Röle şifreli payload'ı görmez
    Diyelim ki Android B relay modunda SOS aldı
    Eğer kullanıcı relay ekranını açarsa
    O zaman ekran "1 paket bekliyor, 2.3 KB" gösterir
    Ve SOS metin içeriği **asla** gösterilmez
    Ve konum bilgisi **asla** gösterilmez
    Ve kişi sayısı **asla** gösterilmez
    Ve yalnızca "Şifreli veri; gizlilik korunuyor" metni görünür

  @U2 @device-required @negative
  Senaryo: Bluetooth kapalıyken röle çalışmaz
    Diyelim ki Android B relay modunda
    Ve Bluetooth kapalı
    Eğer kullanıcı relay durumunu kontrol ederse
    O zaman UI "Bluetooth kapalı; relay devre dışı" gösterir
    Ve arka plan scan çalışmıyor
    Ve UI **asla** "Relay aktif" veya "Dinleniyor" demez

  @U2 @device-required
  Senaryo: Röle internete ulaşınca sunucuya upload yapar
    Diyelim ki Android B'de şifreli SOS outbox'ta
    Ve Android B'de internet bağlantısı var
    Eğer upload job tetiklenirse
    Ve "/v1/ingest" POST isteği başarılı olursa (HTTP 2xx)
    O zaman server "SERVER_ACCEPTED" receipt döner
    Ve Android B bunu BLE ile Android A'ya bildirir (eğer menzilde ise)
    Ve Android A'da durum "SUNUCUYA ULAŞTI" olur
    Ve Android A UI "Sunucuya ulaştı, operatör paneline düştü" gösterir

  @M0 @device-required
  Senaryo: İki Android ile M0 uçtan uca akış
    Diyelim ki Android A (offline, BLE açık) SOS oluşturdu
    Ve Android B (online, BLE açık, relay modu) yakında
    Eğer A ve B BLE ile eşleşirse
    Ve A, SOS'u B'ye aktarırsa
    Ve B, PEER_RECEIVED ack'ını A'ya gönderirse
    Ve B, SOS'u "/v1/ingest" ile sunucuya POST ederse
    Ve server "SERVER_ACCEPTED" dönerse
    Ve operatör panelde canlı feed'de yeni SOS görürse
    Ve operatör vakayı açarsa
    O zaman API "OPERATOR_SEEN" event kaydeder
    Ve operatörde AI sınıflandırma önerisi görünür (Meta anahtar varsa)
    Ve operatör durumu "VAKA İŞLEME ALINDI" güncelleyebilir
    Ve Android A'da durum sırası doğru: CİHAZDA KAYITLI → YAKIN CİHAZA AKTARILDI → SUNUCUYA ULAŞTI → OPERATÖR GÖRDÜ → VAKA İŞLEME ALINDI
    Ve hiçbir adımda UI **"Ekip yolda"** veya **"Güvendesiniz"** demez

  @M0 @negative
  Senaryo: Duplicate paket tek vaka oluşturur (idempotency)
    Diyelim ki Android B aynı SOS'u (aynı message_id) 3 kez POST etti
    Eğer "/v1/ingest" her isteği alırsa
    O zaman veritabanında yalnızca 1 kayıt oluşur
    Ve 3 relay receipt kaydedilir (farklı relay_id ile)
    Ve 2. ve 3. POST 2xx döner ama duplicate olarak işaretlenir

  @M0 @negative
  Senaryo: Offline yolda Meta API çağrısı yapılmaz
    Diyelim ki Android A ve B offline (internet yok, yalnızca BLE)
    Eğer A, SOS'u B'ye BLE ile aktarırsa
    O zaman cihazlarda **hiçbir HTTP istemi** yapılmaz
    Ve Meta AI API'sine **hiçbir ağ çağrısı** gitmez
    Ve SOS B'nin outbox'unda bekler
    Ve A'da durum "YAKIN CİHAZA AKTARILDI" kalır
    Ve UI **asla** "Sunucuya ulaştı" demez

  @U3
  Senaryo: Operatör panelde vaka görüntüler
    Diyelim ki API'de yeni bir SOS kaydı var
    Ve operatör panele giriş yapmış
    Ve canlı feed (SSE) bağlı
    Eğer yeni SOS panelde görünürse
    Ve operatör vakayı seçip açarsa
    O zaman API "OPERATOR_SEEN" event kaydeder
    Ve operatör orijinal mesaj, GPS, zaman damgası görür
    Ve AI önerisi **"Öneri"** başlığı altında gösterilir (**"Karar"** değil)
    Ve operatör manuel override yapabilir (konum/kişi düzeltme)
    Ve operatör durumu "VAKA İŞLEME ALINDI" güncelleyebilir

  @U3 @negative
  Senaryo: Yetkisiz rol vaka göremez
    Diyelim ki kullanıcı "guest" rolüyle panele giriş yapmış
    Eğer "/api/cases" endpoint'ine istek yaparsa
    O zaman HTTP 403 döner
    Ve vaka listesi gösterilmez
    Ve UI "Yetkiniz yok" mesajı gösterir

  @U4
  Senaryo: Meta AI SOS'u sınıflandırır
    Diyelim ki "/v1/ingest" başarılı
    Ve Meta API anahtarı (`MODEL_API_KEY`) mevcut
    Eğer AI worker yeni SOS'u işlerse
    Ve Meta AI API'sine `muse-spark-1.3` ile prompt gönderirse
    O zaman AI JSON cevabı döner:
      """
      {
        "categories": ["deprem", "yaralanma"],
        "persons_estimate": 3,
        "injuries_reported": true,
        "needs": ["tıbbi yardım", "arama-kurtarma"],
        "urgency_suggestion": "yüksek",
        "uncertainty": false,
        "quoted_evidence": "Bina çöktü, 2. kat",
        "location_unknown": false,
        "language": "tr"
      }
      """
    Ve bu çıktı `ai_analyses` tablosuna yazılır
    Ve operatör panelde "AI Önerisi" bölümünde görür
    Ve belirsizlik bayrağı (`uncertainty: true` ise) UI'da **açıkça** gösterilir

  @U4 @negative
  Senaryo: Meta API anahtarı yoksa AI adımı atlanır
    Diyelim ki `MODEL_API_KEY` env değişkeni yok
    Eğer AI worker SOS'u işlemeye çalışırsa
    O zaman AI adımı **BLOCKED_SECRET** olarak işaretlenir
    Ve ham vaka **kaybolmaz**; AI alanı null kalır
    Ve operatör panelde "AI sınıflandırma yapılamadı (anahtar yok)" görür
    Ve operatör ham metni okuyarak manuel sınıflandırma yapar
    Ve M0 kabul testi **"tam M0"** sayılmaz (eksik adım)

  @U4 @negative
  Senaryo: Meta AI timeout veya 5xx hatası
    Diyelim ki Meta AI API'si 30 saniye içinde cevap vermedi
    Veya 500 hatası döndü
    Eğer AI worker retry denerse (3 deneme, exponential backoff)
    Ve hepsi başarısız olursa
    O zaman ham vaka **kaybolmaz**
    Ve AI alanı null kalır
    Ve operatör panelde "AI geçici olarak kullanılamıyor" görür
    Ve operatör ham metni okur

  @U4 @negative
  Senaryo: AI halüsinasyon — açıkça söylenmeyeni uydurma
    Diyelim ki SOS metni: "Yardım edin, kayboldum"
    Ve konum bilgisi yok
    Eğer AI worker işlerse
    O zaman AI çıktısında `location_unknown: true` olmalı
    Ve AI **asla** "Ankara, Çankaya" gibi uydurma konum vermemeli
    Ve operatör panelde "Konum: Bilinmiyor (AI uydurma riski)" gösterilir
    Ve prompt'ta **"Açıkça söylenmeyenleri UYDURMA"** yönergesi var

  @U5 @device-required @negative
  Senaryo: İzin reddi akışı
    Diyelim ki Android A'da Bluetooth izni reddedilmiş
    Eğer uygulama başlarsa
    O zaman UI "Bluetooth izni gerekli; SOS gönderilemez" gösterir
    Ve "Ayarlara Git" butonu sunar
    Ve kullanıcı izin vermeden SOS ekranına **erişemez**
    Ve uygulama **asla** "Bluetooth açık" veya "Hazır" demez

  @U5 @negative
  Senaryo: API 429 rate limit
    Diyelim ki Android B "/v1/ingest" POST yaptı
    Eğer API 429 (Too Many Requests) dönerse
    O zaman Android B exponential backoff uygular (4s, 8s, 16s, 32s)
    Ve 4 denemeden sonra hala 429 ise outbox'ta kalır
    Ve Android A'da durum "YAKIN CİHAZA AKTARILDI" kalır (SERVER_ACCEPTED yok)
    Ve UI **asla** "Sunucuya ulaştı" demez

  @U5 @negative
  Senaryo: API 500 Internal Server Error
    Diyelim ki Android B "/v1/ingest" POST yaptı
    Eğer API 500 dönerse
    O zaman Android B 3 kez retry dener
    Ve başarısız olursa outbox'ta kalır
    Ve sonraki ağ bağlantısında otomatik retry olur
    Ve Android A'da **hala** "YAKIN CİHAZA AKTARILDI"
    Ve UI **asla** "Başarıyla iletildi" demez

  @negative
  Senaryo: Demo/simülasyon açıkça etiketlenir
    Diyelim ki uygulama DEMO modunda
    Eğer kullanıcı herhangi bir ekran açarsa
    O zaman her ekranın üstünde **"DEMO — GERÇEK DEĞİL"** etiketi görünür
    Ve simülasyon verisi kullanıldığında **"Simülasyon verisi"** notu var
    Ve gerçek SOS ile demo SOS karıştırılamaz

  @negative
  Senaryo: 112 uyarısı onboarding'de zorunlu
    Diyelim ki kullanıcı uygulamayı ilk kez açıyor
    Eğer onboarding ekranı gelirse
    O zaman **"Bu uygulama 112 resmî acil çağrı hizmetinin yerine geçmez"** metni görünür
    Ve **"Gerçek acil durumda 112'yi arayın"** uyarısı var
    Ve kullanıcı "Anladım, kabul ediyorum" butonuna basmadan devam edemez

  @negative
  Senaryo: Yasak etiketler UI'da görünmez
    Diyelim ki herhangi bir SOS durumu UI'da gösteriliyor
    Eğer durum "PEER_RECEIVED" ise
    O zaman UI **asla** şunları göstermez:
      | Yasak İfade |
      | Gönderildi |
      | Teslim edildi |
      | Okundu |
      | Ekip yolda |
      | Yardım geliyor |
      | Güvendesiniz |
      | Başarıyla iletildi |
      | Garantili teslimat |
    Ve yalnızca "Yakındaki bir cihaz aldı, internete ulaşması bekleniyor" gösterir
