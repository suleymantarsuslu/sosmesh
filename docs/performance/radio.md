# SOSMesh radyo performansı ve pil politikası (ADIM 42)

Bu belge, **adaptif BLE scan/advertise planlayıcısının** tasarımını özetler. Planlayıcı saf fonksiyondur; gerçek pil tüketimi ölçümü bu ortamda **yapılmadı** — aşağıdaki tablolar sabit profil hedefleridir, cihaz ölçümü değildir.

## Kırmızı çizgiler

- SOSMesh resmî acil (112) servisi değildir.
- Röle düğümleri SOS metnini görmez; yalnızca opak yönlendirme metadata’sı.
- Peer `PEER_RECEIVED` ≠ operatör okundu / kurtarma tamamlandı.
- Planlayıcı **hassas konum takibi yapmaz**; girdiler pil/OS/izin ve **toplam duplicate trafik oranı** ile **kaba link kalitesi skoru** (basis points, PII yok).

## Profil tablosu (hedef duty-cycle)

| Profil | Scan modu | Scan periyot / duraklama (ms) | Advertise aralığı (ms) | Kullanım |
|--------|-----------|-------------------------------|-------------------------|----------|
| `SOS_URGENT` | LOW_LATENCY | 5000 / 2000 | 160 | Aktif SOS aktarımı |
| `SOS_CONSTRAINED` | BALANCED | 8000 / 4000 | 320 | SOS + termal / güç tasarrufu / doze |
| `RELAY_PASSIVE` | LOW_POWER | 10000 / 5000 (+ duplicate yavaşlatma) | 400 | Pasif gönüllü röle |
| `RELAY_CONSTRAINED` | LOW_POWER | 20000 / 15000 | 800 | Röle + düşük pil / termal / OS kısıtı |
| `RELAY_HIGH_POWER` | BALANCED | 7000 / 3000 | 200 | Zayıf link; **açık kullanıcı rızası zorunlu** |
| `BLOCKED` | — | tarama kapalı | kapalı | İzin / kritik pil (röle) / BT kapalı (SOS hariç) |

## Adaptif kurallar (özet)

1. **SOS aktif** her zaman `SOS_*` sınıfında kalır; termal veya güç tasarrufu `SOS_CONSTRAINED` seçer.
2. **Pasif röle** varsayılan `RELAY_PASSIVE`; duplicate trafik oranı ≥ %25 ise scan duraklaması %50 artırılır (pil ve loop yükünü azaltır).
3. **Link kalitesi** skoru &lt; %25 ve duplicate düşükse yüksek güç profili **önerilir**; kullanıcı rızası yoksa pasif profilde kalınır ve UI’da rıza istenir.
4. Pil eşiğinin altında röle **BLOCKED**; SOS aktarımı devam edebilir (mevcut platform makinesi ile uyumlu).

## Kod konumları

- Android: `apps/android/core/platform/AdaptiveRadioPlanner.kt`, `EnergyRadioProfile.kt`, `MeshPlatformStateMachine.kt`
- iOS: `apps/ios/SOSMeshCore/Sources/SOSMeshCore/AdaptiveRadioPlanner.swift`
- Ortak vektörler: `packages/contracts/radio-planner/vectors/radio-planner-cases.json`

## Test kanıtı

- Kotlin: `AdaptiveRadioPlannerTest` (vektör + mutation `ignoreLowPowerConstraints`)
- Swift: `AdaptiveRadioPlannerTests` (aynı JSON, bundled byte-match)

## Doğrulama kanıtı (master plan)

| Kanıt | Durum |
|-------|--------|
| 1 saat kontrollü radyo bütçesi ölçümü (çoklu telefon) | **ölçülemedi** — fiziksel cihaz / laboratuvar yok |
| Stress test (fiziksel) | **NOT_TESTED** — birim vektör testleri CI’da |
| Profil süre/tüketim raporu | Sabit hedefler belgelendi; **gerçek tüketim ölçülmedi** |

## Kullanıcı rızası (yüksek güç)

Android **Ayarlar** ekranında “Yüksek güç radyo profili” anahtarı; iOS **Settings** formunda eşdeğer toggle. Rıza olmadan `RELAY_HIGH_POWER` uygulanmaz.
