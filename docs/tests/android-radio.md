# Android BLE radyo testleri (ADIM 14)

Bu belge **gerçek iki Android cihaz** ile yapılacak keşif/GATT prosedürünü ve OEM matris şablonunu tanımlar. Cloud agent ortamında fiziksel cihaz olmadığı için tablo sonuçları **NOT_TESTED** olarak bırakılmıştır.

## Ön koşullar

- Her iki cihazda SOSMesh debug build yüklü.
- Bluetooth açık; ADIM 12 izin matrisindeki runtime izinler verilmiş.
- Android 12 öncesi cihazlarda konum servisleri açık (scan için).
- İnternet kapalı veya uçak modu (Wi‑Fi/ hücre kapalı); yalnızca BLE kullanılacak.

## A/B keşif prosedürü

1. Cihaz A: uygulamayı aç → **Radyo / peer keşfi (debug)** → **Keşfi başlat**.
2. Cihaz B: aynı adımlar.
3. Her iki ekranda **Keşfedilen peer** sayısının > 0 olduğunu doğrula (ephemeral id; cihaz adı/MAC gösterilmez).
4. A: **İlk peer'e bağlan** → yalnızca **Bağlandı (GATT hazır)** metni GATT `READY` callback sonrası görünmeli.
5. B: aynı bağlantı adımını dene (isteğe bağlı ikinci oturum).

## Aç / kapa

1. Keşif açıkken uygulamayı arka plana al → peer sayısı düşebilir; UI yanlış “bağlandı” dememeli.
2. **Keşfi durdur** → tarama/reklam durur; peer TTL sonrası kayıt düşer.

## Bluetooth kapatma

1. Keşif açıkken sistem Bluetooth'u kapat.
2. UI Bluetooth: kapalı; keşif hata vermeli veya durmalı; uygulama çökmemeli.
3. Bluetooth'u tekrar aç → keşfi yeniden başlat; peer keşfi tekrarlanabilir olmalı.

## İzin kaldırma

1. Ayarlar → uygulama → Yakındaki cihazlar / Konum izinlerinden birini kaldır.
2. Keşfi başlat → izin eksik mesajı; tarama başlamamalı.
3. İzni geri ver → keşif tekrar denenebilir.

## OEM matris şablonu

| OEM | Model | Android | Keşif A→B | GATT oturumu | BT kapatma | İzin kaldırma | Not |
|-----|-------|---------|-----------|--------------|------------|---------------|-----|
| | | | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | |
| | | | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | |

## Birim test kapsamı (CI)

- `GattClientSession`: connect → discover → MTU → ready; disconnect → backoff → reconnect.
- `PeerRegistry`: aynı ephemeral id 10 keşif → 1 kayıt; TTL sonrası düşme.
- `PermissionAndAdapterGuard`: BT kapalı / izin yok → tipli hata, tarama başlamaz.
- `BleAdvertiser`: üretilen manufacturer payload'da cihaz adı/MAC yok (byte assert).

Mutasyon testleri, OEM matris doldurma ve gerçek cihaz testleri **ERTELENDİ**.
