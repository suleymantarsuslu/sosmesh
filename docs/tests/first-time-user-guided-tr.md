# İlk kez kullanıcı — rehberli test senaryosu

**Facilitator script (ADIM 57):** [`docs/user/first-time-user-script.md`](../user/first-time-user-script.md)

**Durum:** `NOT_TESTED` — yalnızca plan; MacBook / fiziksel cihaz aşamasında koşturulacak.  
**Sonuç şablonu:** Aşağıdaki tabloda kanıt doldurulmadan **PASS yazılmaz**.

## Ön koşullar

| # | Koşul | Beklenen | Sonuç |
| --- | --- | --- | --- |
| P0 | 2× Android 12+ fiziksel cihaz veya 1× Android + 1× iOS 17+ | `adb devices` / Xcode cihaz listesi | NOT_TESTED |
| P1 | SOSMesh debug/demo derlemesi yüklü | DEMO banner görünür | NOT_TESTED |
| P2 | Test kimliği sentetik; gerçek GPS/PII yok | Lab koordinatları veya mock | NOT_TESTED |
| P3 | Gönüllü bilgilendirildi (demo-only) | Yazılı/onay notu | NOT_TESTED |

## Senaryo adımları

| Adım | Görev | Başarı ölçütü (kullanıcı anlıyor mu?) | Kanıt (screenshot/video/log) | Sonuç |
| --- | --- | --- | --- | --- |
| 1 | Onboarding: 112 uyarısını oku ve kabul et | “112 yerine geçmez” ifadesini kendi cümlesiyle tekrarlar | — | NOT_TESTED |
| 2 | İzinleri ver / reddet simülasyonu | Reddedince yakın aktarımın durduğunu anlar | — | NOT_TESTED |
| 3 | Rehberli SOS gönder (sentetik) | Durum 1 “cihazda kayıtlı” görür | — | NOT_TESTED |
| 4 | İkinci cihaz yakınlık | Durum 2 “peer” — **operatör okudu sanmaz** | — | NOT_TESTED |
| 5 | İnternet + röle opt-in (gönüllü) | Röle açmadan sunucu yolunun bekleyebileceğini anlar | — | NOT_TESTED |
| 6 | Durum 3–5 (mümkünse demo operatör) | ACK seviyelerinin garanti olmadığını anlar | — | NOT_TESTED |
| 7 | Başarısız iletim (BT kapalı) | 112 + sorun giderme adımlarını uygular | — | NOT_TESTED |
| 8 | Saat (varsa) eşli telefon | Saatın bağımsız mesh olmadığını anlar | — | NOT_TESTED |
| 9 | Web operatör yardım sayfası | Destek formunun `BLOCKED_APPROVAL` olduğunu görür | Playwright raporu (CI) | NOT_TESTED (cihaz) / CI ayrı |

## Kabul kriteri (ADIM 57)

Kullanıcı **bağlantı düzeyini** (cihaz → peer → sunucu → operatör) ve **başarısız iletimde** 112 + uygulama adımlarını ayırt edebilmeli.

## Kanıt dosyası (doldurulacak)

```
docs/handover/evidence/adim57/first-time-user-YYYYMMDD/
  device-matrix.txt
  screen-recording-NOT_REAL_DEVICE.mp4  (veya REAL_DEVICE etiketi)
  facilitator-notes.md
```

**Etiket:** Gerçek cihaz kanıtı yoksa dosya adında `NOT_REAL_DEVICE` kullanın.
