# M0 gerçek cihaz uçtan uca raporu

| Alan | Değer |
| --- | --- |
| **Durum** | **NOT_TESTED** |
| **Test tarihi/saat (UTC)** | _doldurulacak_ |
| **Correlation ID (SOS message UUID)** | _doldurulacak_ |
| **Sonuç** | _PASS / FAIL (henüz işaretlenmedi)_ |
| **Denetçi** | _doldurulacak_ |

Bu dosya **fiziksel M0 kanıtı üretilmedi**. Aşağıdaki prosedür, bağımsız bir kişinin aynı adımları tekrarlayabilmesi içindir. Simülasyon, Robolectric veya mesh-simulator çıktısı **bu rapora PASS yazılamaz**.

## Ön koşullar

- İki gerçek Android telefon (A: afetzede/offline, B: röle/online).
- Yerel veya staging API + operatör web paneli (canlı Meta anahtarı yoksa AI adımı **BLOCKED_SECRET** — ingest devam eder, AI önerisi üretilmez).
- `adb` yetkili cihazlarda; `OPERATOR_BEARER_TOKEN` yalnızca yerel/test API için.
- Correlation ID = SOS `messageId` (UUID); tüm log/trace bu kimlikle eşleştirilir.

## Prosedür A — A offline → B online (ana senaryo)

1. **Hazırlık:** A uçak modu + Bluetooth açık; B mobil veri/Wi‑Fi açık, röle modu kullanıcı onaylı.
2. **SOS (A):** Uygulamada SOS oluştur, onayla; durum **LOCAL_SAVED** görünmeli (ekibe ulaştı / kurtarma iddiası yok).
3. **BLE aktarım:** A ve B ekranda yakın; transfer tamamlanana kadar bekle.
4. **Peer ACK:** A zaman çizelgesinde **PEER_RECEIVED** yalnızca B tarafında doğrulanmış tamamlama sonrası görünmeli.  
   **Not:** Peer ACK, operatörün vakayı okuduğu anlamına **gelmez**; OPERATOR_SEEN ayrı bir olaydır.
5. **Upload (B):** B internete SOS’u yükler; A/B **SERVER_ACCEPTED** yalnızca imzalı sunucu makbuzu doğrulandıktan sonra.
6. **Meta analyze (opsiyonel):** `MODEL_API_KEY` yoksa AI worker **BLOCKED_SECRET** — panelde AI önerisi boş/hata durumu; ingest kaydı korunur.
7. **Panel:** Operatör girişi → harita/liste → vaka açılır → **OPERATOR_SEEN** denetim kaydı oluşur.
8. **Kanıt toplama:**  
   - `bash scripts/m0/collect-logs.sh <correlation-id> evidence/m0/logcat-a.redacted.log` (A) — `message=` / `plaintext:` vb. satır sonuna kadar `[REDACTED_TEXT]`, koordinat/e-posta/telefon maskeleri  
   - Aynı komut B için ikinci dosya  
   - `OPERATOR_BEARER_TOKEN` ortam değişkeni ile `bash scripts/m0/fetch-api-trace.sh <correlation-id> > evidence/m0/api-trace.json` — correlation ID URL-encode; audit/detail alanları `jq` ile maskelenir

## Prosedür B — Rol değiştirme

A ve B rollerini değiştir (A online röle, B offline afetzede). Adım 2–8’i tekrarla; yeni correlation ID ile ayrı satır doldur.

## Prosedür C — Konumsuz SOS

Konum izni kapalı veya GPS yokken SOS gönder. Panelde konum **UNKNOWN**; haritada 0,0 pin **olmamalı**. Android’de konum durumu açıkça bilinmiyor olarak gösterilmeli.

## Hata senaryoları (yanlış yeşil güven denetimi)

| Arıza | Beklenen UI/durum |
| --- | --- |
| API upload 5xx/timeout | Outbox **LOCAL_SAVED** veya hata; **SERVER_ACCEPTED** yok |
| Meta AI hata | Panel: öneri yok / yüklenemedi; vaka işlenebilir |
| GPS yok | `locationStatus=UNKNOWN`, haritada pin yok |
| İnternet yok (B) | Upload ertelenir; “sunucuya ulaştı” yok |

## Cihaz kayıt tablosu (doldurulacak)

| Cihaz | Rol | Model | Android sürümü | IMEI/PII yazmayın |
| --- | --- | --- | --- | --- |
| Telefon 1 | A / B | _doldurulacak_ | _doldurulacak_ | — |
| Telefon 2 | A / B | _doldurulacak_ | _doldurulacak_ | — |

## Video / ekran kaydı

Hackathon sunumu için kayıt **henüz yok** (`demo/storyboard.md`). Fiziksel test videosu üretildiğinde `evidence/m0/` altına eklenir; simülasyon kesiti gerçek diye etiketlenmez.

## İmza

Denetçi onayı: _isim, tarih, PASS/FAIL gerekçesi (1–3 cümle)_
