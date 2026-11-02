# İlk kez kullanıcı — rehberli senaryo (facilitator script)

**ADIM 57** · **Durum:** `NOT_TESTED` (fiziksel cihaz / MacBook aşaması)  
**Amaç:** Kullanıcının **bağlantı düzeyini** (cihaz → peer → sunucu → operatör) ve **başarısız iletimde** 112 + uygulama adımlarını ayırt edebildiğini gözlemlemek.

Detaylı tablo ve kanıt şablonu: [`docs/tests/first-time-user-guided-tr.md`](../tests/first-time-user-guided-tr.md).

---

## Facilitator notları

- Sentetik kimlik; **gerçek GPS, telefon, sağlık veya PII yok**.
- Katılımcıya baştan söyleyin: **SOSMesh 112’nin yerine geçmez**; acil durumda **112**.
- Peer ACK’nin **operatör okudu** anlamına gelmediğini özellikle 4. adımda sorun.
- Destek iletişimi repoda yalnızca yer tutucu: **`DESTEK_ILETISIM_TBD`** (`BLOCKED_APPROVAL`).

---

## Ön koşullar (kısa)

| Koşul | Beklenen |
| --- | --- |
| 2× Android 12+ veya 1× Android + 1× iOS 17+ fiziksel | `adb devices` / Xcode cihaz listesi |
| Debug/demo derleme | DEMO banner (varsa) |
| Lab koordinatları / mock konum | Gerçek konum yok |

---

## Senaryo (okunacak script)

### 1 — Onboarding ve 112

**Facilitator:** “Uygulamayı açın. Sarı/kırmızı uyarıda ne yazıyor?”  
**Beklenen:** “112 yerine geçmez” / resmî acil servisi aramak.  
**Kayıt:** NOT_TESTED

### 2 — İzinler

**Facilitator:** “Bluetooth iznini reddederseniz ne olur?” (isteğe bağlı simülasyon)  
**Beklenen:** Yakın aktarım durur; kayıt cihazda kalır.  
**Kayıt:** NOT_TESTED

### 3 — İlk SOS (sentetik)

**Facilitator:** “Rehberli SOS gönderin. Durum 1 ne anlama geliyor?”  
**Beklenen:** Cihazda kayıtlı — **operatör görmedi**.  
**Kayıt:** NOT_TESTED

### 4 — Peer aktarımı

**Facilitator:** “İkinci cihaz yakında. Durum 2 göründüğünde yardım yolda mı?”  
**Beklenen:** **Hayır** — peer ACK ≠ operatör okudu.  
**Kayıt:** NOT_TESTED

### 5 — Röle opt-in

**Facilitator:** “Gönüllü röle kapalıyken internet yoksa sunucuya ne olur?”  
**Beklenen:** Bekleyebilir; röle **SOS düz metnini okumaz**.  
**Kayıt:** NOT_TESTED

### 6 — Sunucu / operatör basamakları (demo mümkünse)

**Facilitator:** “Durum 3–5 ne garanti eder?”  
**Beklenen:** Teknik iletim — **müdahale veya SLA garantisi yok**.  
**Kayıt:** NOT_TESTED

### 7 — Başarısız iletim

**Facilitator:** “Bluetooth’u kapatın, tekrar deneyin. Ne yaparsınız?”  
**Beklenen:** **112** + izin/BT sorun giderme; spam SOS yok.  
**Kayıt:** NOT_TESTED

### 8 — Saat (varsa)

**Facilitator:** “Saat tek başına mesh garantisi var mı?”  
**Beklenen:** Hayır — eşli telefon yolu.  
**Kayıt:** NOT_TESTED

### 9 — Operatör web yardımı (CI)

**Facilitator:** “Operatör panelinde Yardım sayfasını açın (veya CI Playwright raporuna bakın).”  
**Beklenen:** 112 banner; 5 ACK açıklaması; destek formu `BLOCKED_APPROVAL`.  
**Kayıt:** Playwright/vitest CI (cihaz NOT_TESTED)

---

## Kanıt klasörü

```
docs/handover/evidence/adim57/first-time-user-YYYYMMDD/
  device-matrix.txt
  facilitator-notes.md
  screen-recording-NOT_REAL_DEVICE.mp4
```

Gerçek cihaz kanıtı yoksa dosya adında `NOT_REAL_DEVICE` kullanın.
