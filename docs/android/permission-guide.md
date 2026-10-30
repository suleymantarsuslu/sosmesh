# Android izin rehberi (ADIM 12)

Tek kaynak kod: `core/permissions/.../BlePermissionMatrix.kt`  
Unit testler: `BlePermissionMatrixParameterizedTest` (API 26/30/31/33/34/35/36 tam küme eşitliği).

## Özet

SOSMesh mesh relay için Bluetooth tarama/bağlantı/reklam izinlerini, Android sürümüne göre konum ve bildirim izinlerini ister. **112/resmî acil çağrı yerine geçmez** metinleri izin ekranlarında gösterilir.

## Manifest politikası

- `BLUETOOTH_SCAN` → `android:usesPermissionFlags="neverForLocation"` (konum amaçlı tarama iddiası yok).
- `foregroundServiceType="connectedDevice"` — görünür bildirimli FGS iskeleti; **arka planda sürekli bağlantı garantisi yoktur**.

## Runtime matrisi

| API | Runtime izinler |
|-----|-----------------|
| 26–30 | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `BLUETOOTH`, `BLUETOOTH_ADMIN` |
| 31–32 | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE` |
| 33+ | Yukarı + `POST_NOTIFICATIONS` |
| 34+ | Yukarı + `FOREGROUND_SERVICE_CONNECTED_DEVICE` |

Manifest ek: `FOREGROUND_SERVICE` (API 29+).

## Akış

1. Gerekçeli (rationale) metin  
2. Red → tekrar dene (rationale varsa)  
3. Kalıcı red → `ACTION_APPLICATION_DETAILS_SETTINGS`

## Doğrulama durumu

| Kanıt | Durum |
|-------|--------|
| Gradle unit + lint (ubuntu) | CI ile PASS hedeflenir |
| Robolectric Compose izin UI | CI unit |
| Android 12/14/16 cihaz matrisi | **NOT_TESTED** (enstrümantasyon job yok) |
| En az bir gerçek Android'de açılış | **NOT_TESTED** |
| Android Keystore hardware-backed | **NOT_TESTED** (simülatörsüz CI) |
