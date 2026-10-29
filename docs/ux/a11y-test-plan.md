# SOSMesh — Erişilebilirlik Test Planı

**Versiyon:** 1.0  
**Tarih:** 2026-10-29  
**Kapsam:** ADIM 04 (UX Tasarım Sistemi)  
**Durum:** NOT_TESTED (Manuel testler için plan)

---

## 1. Otomatik Testler (Playwright + axe-core)

### 1.1 Test Kapsamı

- **Prototipler:** Tüm `.html` dosyaları (`prototypes/ux/`)
- **Viewport'lar:** 390x844 (mobil), 1440x900 (desktop)
- **Temalar:** Light, Dark
- **Diller:** TR, EN
- **200% Zoom:** Yatay taşma kontrolü

### 1.2 axe-core Kuralları

- **Serious/Critical:** 0 hedef
- **Moderate:** En aza indirilmeli
- **Minor:** Belgelenmeli

### 1.3 Test Senaryoları

| Test | Açıklama | Beklenen |
|------|----------|----------|
| `axe.run()` | Tüm sayfada axe ihlalleri | 0 serious/critical |
| Zoom 200% | Yatay scroll kontrolü | Yok |
| Kontrast | WCAG AA oranları | ≥4.5 normal, ≥3 büyük |
| Focus ring | Görünürlük | Tüm etkileşimli elemanlarda |
| Alt text | İmgeler için açıklama | Var |
| ARIA labels | Etkileşimli bileşenler | Doğru kullanım |

---

## 2. Manuel Testler (TalkBack / VoiceOver)

### 2.1 Android TalkBack

**Cihaz:** Android 12+  
**Durum:** NOT_TESTED (Bu ADIM kapsamı dışı)

#### Test Adımları:

1. **Aktivasyon:** Ayarlar → Erişilebilirlik → TalkBack → Aç
2. **Navigasyon:** 
   - Sağa kaydır: Sonraki eleman
   - Sola kaydır: Önceki eleman
   - Çift tıkla: Aktive et

#### Test Senaryoları:

| Ekran | Test | Beklenen |
|-------|------|----------|
| Home | SOS butonu odaklanma | "SOS gönder, basılı tutun" okunmalı |
| Home | Alt navigasyon | Her tab okunabilir |
| Status | Timeline | Her durum okunabilir + zaman |
| Relay | Toggle | "Açık/Kapalı" durumu okunmalı |

#### Kontrol Listesi:

- [ ] SOS butonu başlıkta okunuyor mu?
- [ ] Timeline sırası mantıklı mı?
- [ ] Toggle durumu açıkça belirtiliyor mu?
- [ ] Bildirimler erişilebilir mi?

---

### 2.2 iOS VoiceOver

**Cihaz:** iOS 16+  
**Durum:** NOT_TESTED (Bu ADIM kapsamı dışı)

#### Test Adımları:

1. **Aktivasyon:** Ayarlar → Erişilebilirlik → VoiceOver → Aç
2. **Navigasyon:**
   - Sağa kaydır: Sonraki eleman
   - Sola kaydır: Önceki eleman
   - Çift tıkla: Aktive et
3. **Rotor:** İki parmakla döndür → Başlıklar, Bağlantılar, Form Elemanları seç

#### Test Senaryoları:

| Ekran | Test | Beklenen |
|-------|------|----------|
| Home | SOS butonu | "SOS gönder, basılı tutun" |
| Status | Disclaimer | Uyarı metni okunmalı |
| Settings | İzin toggle'ları | Her izin durumu okunmalı |

#### Kontrol Listesi:

- [ ] Rotor ile başlıklar arası geçiş çalışıyor mu?
- [ ] Form elemanları erişilebilir mi?
- [ ] Dinamik içerik (durum güncellemeleri) bildiriliyor mu?

---

### 2.3 watchOS VoiceOver

**Cihaz:** watchOS 9+  
**Durum:** NOT_TESTED (Bu ADIM kapsamı dışı)

#### Test Senaryoları:

| Ekran | Test | Beklenen |
|-------|------|----------|
| Watch SOS | Basılı tut | Haptic + sesli geri bildirim |
| Watch Status | Timeline | Kompakt durum isimleri okunmalı |

#### Kontrol Listesi:

- [ ] Haptic feedback çalışıyor mu?
- [ ] SOS gönderildiğinde sesli onay var mı?
- [ ] Küçük metin okunabilir mi?

---

### 2.4 Web Ekran Okuyucular

**Araçlar:** NVDA (Windows), JAWS (Windows), VoiceOver (macOS)  
**Durum:** NOT_TESTED (Bu ADIM kapsamı dışı)

#### Test Senaryoları:

| Ekran | Test | Beklenen |
|-------|------|----------|
| Dashboard | Skip link | "Ana içeriğe geç" çalışmalı |
| Dashboard | Sidebar navigasyon | Her link okunabilir |
| Dashboard | Tablo | `<caption>` + `<th>` okunmalı |
| Map | Harita | `aria-label` ile açıklama |
| Inbox | Liste | `role="list"` okunmalı |

#### Kontrol Listesi:

- [ ] Skip link Tab ile erişilebilir mi?
- [ ] Landmark'lar (`<nav>`, `<main>`) doğru mu?
- [ ] Tablolar `<caption>` içeriyor mu?
- [ ] Formlar `<label>` ile ilişkilendirilmiş mi?

---

## 3. Klavye Navigasyonu

**Durum:** Playwright ile otomatik test edilebilir

#### Test Senaryoları:

| Eylem | Tuş | Beklenen |
|-------|-----|----------|
| İlk elemana odaklan | `Tab` | SOS butonu odaklanmalı |
| Sonraki eleman | `Tab` | Sıralı navigasyon |
| Önceki eleman | `Shift+Tab` | Ters sıralı navigasyon |
| SOS butonu aktive et | `Enter` veya `Space` | Onay diyalogu açılmalı |
| Relay toggle | `Enter` veya `Space` | Açık/Kapalı değişmeli |
| Diyalog kapat | `Esc` | Diyalog kapanmalı |

#### Kontrol Listesi:

- [ ] Tüm etkileşimli elemanlar klavye ile erişilebilir mi?
- [ ] Fokus sırası mantıklı mı?
- [ ] Focus ring tüm elemanlarda görünür mü?
- [ ] Skip link çalışıyor mu?

---

## 4. Renk Körlüğü Testleri

**Araçlar:** Stark (Figma), Color Oracle (Desktop)  
**Durum:** NOT_TESTED (Manuel kontrol gerekli)

#### Test Senaryoları:

| Varyasyon | Test | Beklenen |
|-----------|------|----------|
| Protanopia (Kırmızı körlüğü) | SOS butonu | İkon + metin kombinasyonu ayırt edilebilir |
| Deuteranopia (Yeşil körlüğü) | Status badge | Yalnız renk değil, metin de var |
| Tritanopia (Mavi körlüğü) | Info badge | Ayırt edilebilir |
| Achromatomaly (Renk zayıflığı) | Tüm renkler | Kontrast yeterli |

#### Kontrol Listesi:

- [ ] Durum badge'lerde yalnız renk kullanılmamış mı?
- [ ] İkon + metin kombinasyonu var mı?
- [ ] Kontrast oranları uygun mu?

---

## 5. Büyük Yazı Modu

**Cihazlar:** iOS (Dynamic Type), Android (Font Scale)  
**Durum:** NOT_TESTED (Manuel kontrol gerekli)

#### Test Senaryoları:

| Platform | Ayar | Beklenen |
|----------|------|----------|
| iOS | Ayarlar → Görüntü → Metin Boyutu → Maksimum | Layout bozulmamalı |
| Android | Ayarlar → Ekran → Yazı Tipi Boyutu → En Büyük | Metin taşmamalı |
| Web | `html[data-text-size="xlarge"]` | 200% zoom, yatay taşma yok |

#### Kontrol Listesi:

- [ ] SOS butonu büyük yazıda okunabilir mi?
- [ ] Timeline metinleri taşıyor mu?
- [ ] Alt navigasyon etiketleri görünür mü?

---

## 6. Lighthouse Skorları

**Araç:** Chrome DevTools → Lighthouse  
**Durum:** NOT_TESTED (Manuel çalıştırılmalı)

#### Beklenen Skorlar:

| Kategori | Hedef | Not |
|----------|-------|-----|
| Performance | ≥90 | Statik HTML, hızlı olmalı |
| Accessibility | 100 | WCAG AA uyumu |
| Best Practices | ≥90 | Modern standartlar |
| SEO | ≥80 | Meta etiketler |

#### Kontrol Listesi:

- [ ] Performance skoru ≥90 mı?
- [ ] Accessibility skoru 100 mü?
- [ ] Kontrast uyarıları var mı?
- [ ] ARIA kullanımı doğru mu?

---

## 7. Test Sonuçları (ADIM 04)

| Test Türü | Durum | Sonuç | Notlar |
|-----------|-------|-------|--------|
| Playwright + axe-core | ✅ YAPILDI | PASS | Screenshot'lar artifacts/ altında |
| Kontrast kontrolü | ✅ YAPILDI | PASS | WCAG AA uyumlu |
| Yasak ifade taraması | ✅ YAPILDI | PASS | 0 ihlal |
| i18n anahtar eşitliği | ✅ YAPILDI | PASS | TR/EN eşit |
| TalkBack (Android) | ❌ NOT_TESTED | — | Manuel test gerekli |
| VoiceOver (iOS) | ❌ NOT_TESTED | — | Manuel test gerekli |
| VoiceOver (watchOS) | ❌ NOT_TESTED | — | Manuel test gerekli |
| NVDA/JAWS (Web) | ❌ NOT_TESTED | — | Manuel test gerekli |
| Renk körlüğü | ❌ NOT_TESTED | — | Stark/Color Oracle gerekli |
| Büyük yazı modu | ❌ NOT_TESTED | — | Cihaz gerekli |
| Lighthouse | ❌ NOT_TESTED | — | Chrome DevTools |

---

## 8. Sonraki Adımlar

### ADIM 12–16 (Android Geliştirme):
- TalkBack ile entegre testler
- Compose Semantics kullanımı
- Büyük yazı modu testleri

### ADIM 31–34 (iOS Geliştirme):
- VoiceOver ile entegre testler
- SwiftUI Accessibility kullanımı
- Dynamic Type testleri

### ADIM 35–39 (Wearable Geliştirme):
- Wear OS / watchOS erişilebilirlik
- Haptic feedback
- Sesli geri bildirim

### ADIM 21–23 (Web Geliştirme):
- NVDA/JAWS testleri
- Lighthouse CI entegrasyonu
- Pa11y otomatik testleri
