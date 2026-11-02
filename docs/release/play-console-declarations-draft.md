# Play Console — Data safety ve izin beyanı taslağı (ADIM 51)

**Durum:** Taslak — mağaza gönderimi **BLOCKED_APPROVAL** (kullanıcı onayı gerekir).

Bu belge kod tabanındaki gerçek izinleri ve veri akışını yansıtır; hukuki metin avukat/veri koruma incelemesi gerektirir (`docs/legal/privacy-policy-draft.md`).

## Veri toplama özeti (Data safety formu)

| Veri türü | Toplanır mı? | Amaç | Şifreli mi? | Kullanıcı silme |
| --- | --- | --- | --- | --- |
| Acil SOS metni / kişi sayısı | Evet (kullanıcı girişi) | Yardım talebi iletimi | Evet (envelope); röle ciphertext görür | Sunucu retention ADR-013 |
| Konum (GPS veya bilinmiyor) | Koşullu | Konum doğruluğu göstergesi | Metadata + şifreli payload | Aynı |
| Bluetooth / cihaz radyo durumu | Evet (cihaz üzerinde) | Mesh aktarımı | Yerel olaylar; PII redakte log | Uygulama verisi temizleme (Settings metni) |
| Kurulum relay kimliği (rastgele) | Evet | Upload dedup / abuse azaltma | HTTPS ingest meta | Yerel prefs |
| Crash raporları | Evet (yalnız cihazda dosya) | Tanılama | Yerel JSON, PII redakte | Uygulama verisi silinince |
| Analytics / reklam SDK | **Hayır** | — | — | — |

**Harici crash/analytics servisi yok** — `RedactedLocalCrashReporter` yalnız `filesDir/sosmesh-crash/` yazar.

## AndroidManifest izinleri (beyan referansı)

Kaynak: `apps/android/app/src/main/AndroidManifest.xml`

| İzin | Gerekçe (kullanıcı metni) |
| --- | --- |
| `BLUETOOTH_SCAN` / `CONNECT` / `ADVERTISE` (API 31+) | Yakındaki gönüllü cihazlarla internetsiz SOS aktarımı |
| `ACCESS_FINE/COARSE_LOCATION` (maxSdk 30) | Android 11 ve altında BLE tarama politikası |
| `INTERNET` / `ACCESS_NETWORK_STATE` | Gönüllü röle modunda şifreli upload |
| `FOREGROUND_SERVICE` + `CONNECTED_DEVICE` | Aktif röle oturumu bildirimi |
| `POST_NOTIFICATIONS` | Röle / durum bildirimleri |

## Play review notları (iç kullanım)

- Uygulama **resmî 112/acil çağrı yerine geçmez** (store açıklamasında tekrarlanmalı).
- Demo flavor (`applicationId` `.demo`) yalnız iç dağıtım; prod track **prod** flavor AAB.
- Gerçek production API URL ve receipt public key dağıtımı **BLOCKED_APPROVAL** (BuildConfig placeholder host).

## Onay bekleyen eylemler

1. Play Console Data safety formunu bu tabloya göre doldurmak  
2. Production `INGEST_BASE_URL` + receipt SPKI dağıtımı (secret repoda yok)  
3. Internal / closed test track yükleme (**BLOCKED_APPROVAL**)
