# SOSMesh Teknik Borç Kayıt Defteri

Bu dosya, kabul edilmiş ancak gelecekte kapatılması gereken teknik borçları takip eder.

## Format

```
TD-<ADIM>-<ID>: Kısa açıklama
  Durum: OPEN | IN_PROGRESS | CLOSED
  Tanımlandığı ADIM: XX
  Hedef Kapatma ADIM: YY
  Etki: LOW | MEDIUM | HIGH
  Detay: ...
  Kanıt: (dosya yolu veya açıklama)
```

---

## ADIM 04 - UX Information Architecture and Design System

### TD-04-W1: Watch durum ekran görüntüsü gerçek durum ekranını göstermiyor

**Durum:** OPEN  
**Tanımlandığı ADIM:** 04  
**Hedef Kapatma ADIM:** watchOS/Wear OS native UI implementasyonu öncesi (ADIM 15-20 arası bekleniyor)  
**Etki:** MEDIUM  
**Detay:**  
- `watch-status-{198x242,184x224}.png` ekran görüntüleri iptal sonrası durum ekranını ("SOS gönderilmedi") gösteriyor
- Gerçek 5 aşamalı SOS durum timeline ekranının ekran görüntüsü eksik
- Test Playwright'ta cancel flow'u test ederken bu durum yakalandı
- Mobil ve web prototiplerinin durum ekranları tam, yalnız watch prototype'ı eksik

**Kanıt:**
- `/opt/cursor/artifacts/adim04/watch-status-198x242.png` - cancelled screen
- `/opt/cursor/artifacts/adim04/watch-sos-198x242.png` - initial screen
- Eksik: 5 timeline item'lı durum ekranı

**Geçici Çözüm:** Mobil/web prototipleri bağımsız denetimden geçti; watch UI gerçek cihaz implementasyonunda doğru durum ekranı eklenecek.

---

### TD-04-W2: Saat ekran görüntülerinde tokens.css yüklenememiş (serif font)

**Durum:** OPEN  
**Tanımlandığı ADIM:** 04  
**Hedef Kapatma ADIM:** watchOS/Wear OS native UI implementasyonu öncesi  
**Etki:** LOW  
**Detay:**
- Saat prototip ekran görüntülerinde font ailesi serif olarak render edilmiş
- `tokens.css` yolu veya Playwright'ın file:// protokolünde CSS yükleme sorunu olabilir
- Prototip HTML doğru `<link rel="stylesheet" href="../../packages/design-tokens/tokens.css">` referansına sahip
- Renkler ve layout doğru, yalnız font family değişken yüklenmemiş

**Kanıt:**
- `/opt/cursor/artifacts/adim04/watch-cancel-198x242.png` - serif font görünüyor
- `prototypes/ux/watch-sos.html:5` - tokens.css bağlantısı mevcut

**Geçici Çözüm:** Design token değerleri doğru; native implementasyonda sistem fontları (SF Pro, Roboto) kullanılacak, bu sorun ortadan kalkacak.

---

### TD-04-W3: Saat master etiketleri 9px font ile render edilmiş

**Durum:** OPEN  
**Tanımlandığı ADIM:** 04  
**Hedef Kapatma ADIM:** watchOS/Wear OS native UI implementasyonu öncesi  
**Etki:** MEDIUM  
**Detay:**
- 5 TR master status etiketi 198x242px ve 184x224px ekranlara sığması için 9px font + `<br/>` satır kırma kullanıldı
- WCAG 2.1 SC 1.4.4 (Text Resize) 200% zoom testi geçiyor ancak base font çok küçük
- Özellikle "YAKIN CİHAZA AKTARILDI" ve "VAKA İŞLEME ALINDI" etiketleri sıkışık
- Apple Watch Ultra (410x502) gibi daha büyük ekranlarda yeniden test edilmeli

**Kanıt:**
- `prototypes/ux/watch-sos.html:229-253` - 9px font-size inline style
- Master etiketler kısaltılmamış (L4 gereksinimi karşılandı) ancak okunabilirlik sorunu

**Geçici Çözüm:** Native implementasyonda watchOS Dynamic Type ve Material Design scaled fonts kullanılarak dinamik font boyutlandırma yapılacak.

---

### TD-04-W4: İptal geri sayımı üstten kesik

**Durum:** OPEN  
**Tanımlandığı ADIM:** 04  
**Hedef Kapatma ADIM:** watchOS/Wear OS native UI implementasyonu öncesi  
**Etki:** LOW  
**Detay:**
- `watch-cancel-{198x242,184x224}.png` ekran görüntülerinde geri sayım numarası (3, 2, 1) üst kısmından hafifçe kesik görünüyor
- `font-size: var(--type-fontSize-3xl)` (1.875rem = ~30px) küçük ekranda padding yetersiz
- İptal butonu ≥44px ve tıklanabilir (L1 gereksinimi karşılandı)
- Estetik sorun, fonksiyon tam

**Kanıt:**
- `/opt/cursor/artifacts/adim04/watch-cancel-198x242.png` - countdown top crop
- `prototypes/ux/watch-sos.html:145-147` - cancel-countdown style

**Geçici Çözüm:** Native implementasyonda platform UI guidelines (Apple HIG, Material Design) ile doğru spacing ve safe area insets uygulanacak.

---

## Kapalı Borçlar

_(Şu anda kapalı borç yok)_

---

**Son Güncelleme:** 2026-10-29  
**Toplam Açık Borç:** 4 (ADIM 04 watch UI)
