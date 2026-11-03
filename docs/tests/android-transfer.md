# Android SOS BLE transfer testleri (ADIM 15)

Gerçek iki Android cihaz olmadan tablo sonuçları **NOT_TESTED**; JVM simülasyonu gerçek BLE kanıtı sayılmaz. Kısa cihaz prosedürü: [android-device-ble-checklist.md](./android-device-ble-checklist.md).

## Ön koşullar

- ADIM 14 keşif/GATT prosedürü (`docs/tests/android-radio.md`) tamamlanmış veya eşdeğer debug build.
- Cihaz A: SOS gönderici; cihaz B: alıcı veya röle (outbox).
- İnternet kapalı; yalnızca BLE.

## A → B transfer prosedürü

1. A: SOS oluştur → durum **CİHAZDA KAYITLI** (`LOCAL_SAVED`).
2. Her iki cihazda mesh keşfi açık; GATT **READY**.
3. A: peer'e bağlan → şifreli wire JSON transferi başlat.
4. B: chunk ACK'ları gönderir; SHA-256 digest doğrulanır.
5. A: yalnızca tüm chunk ACK'ları alındıktan sonra **YAKIN CİHAZA AKTARILDI** (`PEER_RECEIVED`) — sunucu/operatör okundu anlamına gelmez.
6. B (röle): payload **çözülmeden** outbox'a yazılır.

## Radyo trace şablonu (JSONL, PII yok)

```json
{"ts_ms":0,"event":"hello_sent","msg_id":"a1b2c3d4","seq":null,"total":null,"error":null}
{"ts_ms":120,"event":"chunk_received","msg_id":"a1b2c3d4","seq":0,"total":3,"error":null}
{"ts_ms":450,"event":"ack_received","msg_id":"a1b2c3d4","seq":0,"total":null,"error":null}
{"ts_ms":900,"event":"transfer_complete","msg_id":"a1b2c3d4","seq":null,"total":3,"error":null}
```

| Adım | A UI durumu | B outbox | Kanıt |
|------|-------------|----------|-------|
| Transfer öncesi | LOCAL_SAVED | — | NOT_TESTED |
| Digest OK + ACK | PEER_RECEIVED | 1 satır (dedup) | NOT_TESTED |
| Bozuk CRC | LOCAL_SAVED | değişmez | JVM unit PASS |
| SHA uyuşmazlığı | LOCAL_SAVED | PEER_RECEIVED yok | JVM unit PASS |

## CI birim kapsamı

- `BleChunkCodecGoldenTest`: `packages/fixtures/ble/test-vectors.json` paylaşımlı fixture.
- `BleTransferSimulatedTest`: mock kanal, ACK timeout/resume, sender PEER gate.
- `RelayEnvelopeTests`: decrypt API yok; duplicate `id` tek outbox.

Mutasyon, 20× gerçek cihaz, BT kopma saha testi **ERTELENDİ**.
