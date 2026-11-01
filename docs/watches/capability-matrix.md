# Saat yetenek matrisi (ADIM 39)

Ortak «telefona ulaşılamıyor» dili: `WatchCapabilityMatrix.phoneNotReachableCopy` (watchOS) ↔ `WearStateSyncEngine` (Wear OS).

| ID | Özellik | watchOS | Wear OS | Not |
|----|---------|---------|---------|-----|
| `companion_sos` | Eşleşmiş telefona SOS | supported | supported | Companion kanalı |
| `offline_queue` | Telefon yokken yerel kuyruk | supported | supported | Sahte başarı yok |
| `complication` | Yüzey kısayolu | supported | experimental | WidgetKit |
| `direct_https` | Saatin kendi ağı ile HTTPS | experimental | unsupported | Ayrı flag |
| `offline_mesh_relay` | Saat → başka telefon BLE mesh | unsupported | unsupported | Bilinçli kapalı |

## Bağlantı senaryoları (6)

1. **Paired + phone app foreground** — anlık WC, outbox ACK  
2. **Paired + phone background** — `transferUserInfo`, gecikme gösterimi  
3. **Phone off / menzil dışı** — offline kuyruk, retry  
4. **Watch locked** — kuyruk, kullanıcı mesajı  
5. **Not paired** — mesh garantisi yok mesajı  
6. **Direct internet (watch LTE)** — yalnızca experimental flag; production dışı  

Kaynak kod: `apps/ios/SOSMeshCore/Sources/SOSMeshCore/WatchCompanion/WatchCapabilityMatrix.swift`.

## Bilinçli sınırlar

- 112 yerine geçmez.
- Saat bağımsız mesh rölesi değildir.
- Peer ACK ≠ operatör okundu.
- Apple, force-quit ve arka plan WC iletimi için garanti vermez; UI ve kopya «garanti» dili kullanmaz.
