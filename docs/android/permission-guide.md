# Android izin rehberi (ADIM 12)

Tek kaynak kod: `core/permissions/.../BlePermissionMatrix.kt`  
Unit testler: `RuntimePermissionsParameterizedTest`, `ManifestPermissionsParameterizedTest`, `AndroidManifestPermissionConsistencyTest`.

## Özet

Runtime (dangerous) izinler `requestPermissions` ile istenir; normal/install-time izinler yalnız manifestte bildirilir. **112/resmî acil çağrı yerine geçmez** metinleri izin ekranlarında gösterilir.

## Manifest politikası

- `BLUETOOTH_SCAN` → `usesPermissionFlags="neverForLocation"`
- `BLUETOOTH` / `BLUETOOTH_ADMIN` → `maxSdkVersion="30"`
- `ACCESS_FINE/COARSE_LOCATION` → `maxSdkVersion="30"` (legacy BLE tarama)
- `POST_NOTIFICATIONS` → `minSdkVersion="33"`
- `FOREGROUND_SERVICE_CONNECTED_DEVICE` → `minSdkVersion="34"`
- FGS tipi `connectedDevice` — görünür bildirim; **arka planda sürekli bağlantı garantisi yoktur**

## Runtime matrisi (`runtimePermissions`)

| API | Dangerous (runtime) izinler |
|-----|----------------------------|
| 26–30 | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` |
| 31–32 | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE` |
| 33+ | 31+ kümesi + `POST_NOTIFICATIONS` |

## Manifest matrisi (`manifestPermissions`)

| API | Normal (manifest-only) izinler |
|-----|--------------------------------|
| 26–28 | `BLUETOOTH`, `BLUETOOTH_ADMIN` |
| 29–30 | `BLUETOOTH`, `BLUETOOTH_ADMIN`, `FOREGROUND_SERVICE` |
| 31–33 | `FOREGROUND_SERVICE` |
| 34+ | `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE` |

Kaynak manifestteki `uses-permission` kümesi (min/maxSdk filtreli) = `runtimePermissions ∪ manifestPermissions`.

## Akış

1. Gerekçeli (rationale) metin  
2. Red → tekrar dene (rationale varsa)  
3. Kalıcı red → `ACTION_APPLICATION_DETAILS_SETTINGS`

## Doğrulama durumu

| Kanıt | Durum |
|-------|--------|
| Gradle unit + lint (ubuntu) | CI PASS hedefi |
| Robolectric Compose izin UI | CI unit |
| Android 12/14/16 cihaz matrisi | **NOT_TESTED** |
| En az bir gerçek Android'de açılış | **NOT_TESTED** |
| Android Keystore hardware-backed | **NOT_TESTED** |
