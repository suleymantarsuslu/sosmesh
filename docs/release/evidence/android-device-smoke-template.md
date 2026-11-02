# ADIM 51 cihaz smoke kanıt şablonu

**Durum:** NOT_TESTED (Cloud Agent — fiziksel cihaz yok)

| Alan | Değer |
| --- | --- |
| Tarih (UTC) | |
| Operatör | |
| APK yolu | `apps/android/app/build/outputs/apk/prod/release/app-prod-release.apk` |
| APK SHA-256 | |
| AAB SHA-256 (opsiyonel) | `app/build/outputs/bundle/prodRelease/app-prod-release.aab` |
| R8 mapping | `app/build/outputs/mapping/prodRelease/mapping.txt` |
| Flavor | prod |
| versionName / versionCode | |
| Cihaz A (model / OS) | |
| Cihaz B (model / OS) | |

## Senaryo sonuçları

| ID | Senaryo | Sonuç (PASS/FAIL/NOT_TESTED) | Not |
| --- | --- | --- | --- |
| S1 | BLE keşif + GATT (2 cihaz) | NOT_TESTED | |
| S2 | İzin reddi / Bluetooth kapalı UX | NOT_TESTED | |
| S3 | Doze / pil tasarrufu (röle duraklatma metni) | NOT_TESTED | |
| S4 | 24 saat yeniden bağlanma (simüle veya gerçek) | NOT_TESTED | |
| S5 | M0+M1 temel akış (offline SOS → peer → upload) | NOT_TESTED | |

## Ekler

- `adb-devices.txt`
- `apk-sha256.txt`
- Ekran kaydı / logcat redakte export (PII yok)

**Play Internal Test / production track:** hazır, uygulanmadı (**BLOCKED_APPROVAL**)
