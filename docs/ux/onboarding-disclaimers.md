# SOSMesh — Onboarding Uyarıları ve İzin Açıklamaları

**Amaç:** Kullanıcı ilk kez uygulamayı açtığında gösterilecek **zorunlu** uyarı ve izin metinleri (Türkçe + İngilizce).

**Tasarım Kuralları:**
- Sade dil, teknik jargon yok
- Ana uyarı ≤3 cümle
- Erişilebilirlik: ekran okuyucu etiketleri, büyük yazıda kısaltılmamış anlam
- DEMO/SİMÜLASYON metni ayrı ekranda

---

## 1. Ana Uyarı (Zorunlu Kabul)

### 1.1 Türkçe

**Başlık:** ⚠️ ÖNEMLİ UYARI

**Metin:**

> Bu uygulama **Türkiye'de 112 resmî acil çağrı hizmetinin yerine geçmez**.  
> Gerçek acil durumda **önce 112'yi arayın**.  
> SOSMesh yalnızca deneysel bir mesh haberleşme sistemidir; fiziksel yardım garantisi vermez.

**Buton:** "Anladım, Kabul Ediyorum"

**Ekran Okuyucu Etiketi:**
> "Uyarı: Bu uygulama 112 resmî acil çağrı hizmetinin yerine geçmez. Gerçek acil durumda önce 112'yi arayın. SOSMesh yalnızca deneysel bir mesh haberleşme sistemidir; fiziksel yardım garantisi vermez. Anladım, kabul ediyorum butonuna basarak devam edebilirsiniz."

---

### 1.2 İngilizce

**Başlık:** ⚠️ IMPORTANT WARNING

**Metin:**

> This app **does not replace official emergency services (e.g., 911, 112)**.  
> In a real emergency, **call official emergency services first**.  
> SOSMesh is an experimental mesh communication system; it does not guarantee physical rescue.

**Buton:** "I Understand and Accept"

**Ekran Okuyucu Etiketi:**
> "Warning: This app does not replace official emergency services such as 911 or 112. In a real emergency, call official emergency services first. SOSMesh is an experimental mesh communication system; it does not guarantee physical rescue. Tap 'I Understand and Accept' to continue."

---

## 2. İzin Açıklamaları

### 2.1 Bluetooth İzni

#### Türkçe

**Başlık:** Bluetooth İzni Gerekli

**Metin:**

> SOSMesh, SOS mesajlarını yakındaki cihazlarla paylaşmak için Bluetooth Low Energy (BLE) kullanır.  
> **İnternet olmadan** mesajınızı iletebilmemiz için Bluetooth gereklidir.

**İzin Reddi Senaryosu:**
> "Bluetooth izni olmadan SOS gönderemezsiniz. İzin vermek için Ayarlara gidin."

**Ekran Okuyucu Etiketi:**
> "Bluetooth izni: SOSMesh, SOS mesajlarını yakındaki cihazlarla paylaşmak için Bluetooth Low Energy kullanır. İnternet olmadan mesajınızı iletebilmemiz için Bluetooth gereklidir. İzni reddettiğinizde SOS gönderemezsiniz."

---

#### İngilizce

**Başlık:** Bluetooth Permission Required

**Metin:**

> SOSMesh uses Bluetooth Low Energy (BLE) to share SOS messages with nearby devices.  
> Bluetooth is required to deliver your message **without internet**.

**İzin Reddi Senaryosu:**
> "You cannot send SOS without Bluetooth permission. Go to Settings to grant permission."

**Ekran Okuyucu Etiketi:**
> "Bluetooth permission: SOSMesh uses Bluetooth Low Energy to share SOS messages with nearby devices. Bluetooth is required to deliver your message without internet. If you deny this permission, you cannot send SOS messages."

---

### 2.2 Konum İzni (Opsiyonel)

#### Türkçe

**Başlık:** Konum İzni (Opsiyonel)

**Metin:**

> Konumunuzu eklemek, koordinasyon ekibinin size daha hızlı ulaşmasına yardımcı olur.  
> **İzin vermek zorunlu değildir**; "konum bilinmiyor" olarak da SOS gönderebilirsiniz.

**İzin Reddi Senaryosu:**
> "Konum izni verilmedi. SOS 'konum bilinmiyor' olarak kaydedilecek."

**Ekran Okuyucu Etiketi:**
> "Konum izni: Opsiyonel. Konumunuzu eklemek, koordinasyon ekibinin size daha hızlı ulaşmasına yardımcı olur. İzin vermek zorunlu değildir; konum bilinmiyor olarak da SOS gönderebilirsiniz. İzni reddederseniz, SOS konum bilinmiyor olarak kaydedilir."

---

#### İngilizce

**Başlık:** Location Permission (Optional)

**Metin:**

> Including your location helps the coordination team locate you faster.  
> **Permission is not required**; you can still send SOS with "location unknown."

**İzin Reddi Senaryosu:**
> "Location permission denied. SOS will be saved as 'location unknown.'"

**Ekran Okuyucu Etiketi:**
> "Location permission: Optional. Including your location helps the coordination team locate you faster. Permission is not required; you can still send SOS with location unknown. If you deny this permission, SOS will be saved as location unknown."

---

### 2.3 Bildirim İzni (Opsiyonel)

#### Türkçe

**Başlık:** Bildirim İzni (Opsiyonel)

**Metin:**

> SOS'unuzun durumu değiştiğinde (ör. "Sunucuya ulaştı", "Operatör gördü") bildirim alırsınız.  
> İzin vermezseniz yalnızca uygulama içinde durum görebilirsiniz.

**Ekran Okuyucu Etiketi:**
> "Bildirim izni: Opsiyonel. SOS'unuzun durumu değiştiğinde bildirim alırsınız. Örneğin, sunucuya ulaştı veya operatör gördü. İzin vermezseniz yalnızca uygulama içinde durum görebilirsiniz."

---

#### İngilizce

**Başlık:** Notification Permission (Optional)

**Metin:**

> You will receive notifications when your SOS status changes (e.g., "Reached server," "Operator viewed").  
> Without permission, you can only check status within the app.

**Ekran Okuyucu Etiketi:**
> "Notification permission: Optional. You will receive notifications when your SOS status changes, such as reached server or operator viewed. Without permission, you can only check status within the app."

---

## 3. DEMO/SİMÜLASYON Etiketi

### 3.1 Türkçe

**Ekran Üst Banner (Her Ekranda):**

```
┌──────────────────────────────────────┐
│  🔴 DEMO — GERÇEK DEĞİL              │
└──────────────────────────────────────┘
```

**Simülasyon Verisi Notu (Vaka Listesinde):**

> ℹ️ Simülasyon verisi — Test amaçlıdır, gerçek vaka değil

**Ekran Okuyucu Etiketi:**
> "Demo modu: Bu ekran simülasyon veya demo içeriği göstermektedir. Gerçek acil durum verisi değildir."

---

### 3.2 İngilizce

**Ekran Üst Banner (Her Ekranda):**

```
┌──────────────────────────────────────┐
│  🔴 DEMO — NOT REAL                  │
└──────────────────────────────────────┘
```

**Simülasyon Verisi Notu (Vaka Listesinde):**

> ℹ️ Simulation data — For testing purposes, not a real case

**Ekran Okuyucu Etiketi:**
> "Demo mode: This screen shows simulation or demo content. It is not real emergency data."

---

## 4. Gönüllü Röle (Relay) Modu Opt-in

### 4.1 Türkçe

**Başlık:** Gönüllü Röle Modu

**Metin:**

> Relay modu aktif olduğunda, cihazınız yakındaki afetzedelerden SOS mesajı alıp internete iletir.  
> **Gizlilik:** SOS içeriğini **göremezsiniz**; şifreli veri taşırsınız.  
> **Pil:** Arka planda BLE taraması yapar; pil ~%5–15 etkilenebilir (cihaza bağlı).  
> İstediğiniz zaman durdurabilirsiniz.

**Pil Eşiği Uyarısı:**
> ⚠️ Pil seviyesi %20'nin altına düştüğünde relay otomatik durur.

**Buton:** "Relay Modunu Aktifleştir"

**Ekran Okuyucu Etiketi:**
> "Gönüllü röle modu: Relay modu aktif olduğunda, cihazınız yakındaki afetzedelerden SOS mesajı alıp internete iletir. Gizlilik: SOS içeriğini göremezsiniz, şifreli veri taşırsınız. Pil: Arka planda BLE taraması yapar, pil yaklaşık yüzde 5 ila yüzde 15 etkilenebilir. Pil seviyesi yüzde 20'nin altına düştüğünde relay otomatik durur. İstediğiniz zaman durdurabilirsiniz."

---

### 4.2 İngilizce

**Başlık:** Volunteer Relay Mode

**Metin:**

> When relay mode is active, your device receives SOS messages from nearby victims and forwards them to the internet.  
> **Privacy:** You **cannot see** SOS content; you carry encrypted data.  
> **Battery:** Background BLE scanning may impact battery ~5–15% (device dependent).  
> You can stop anytime.

**Pil Eşiği Uyarısı:**
> ⚠️ Relay will automatically stop when battery drops below 20%.

**Buton:** "Activate Relay Mode"

**Ekran Okuyucu Etiketi:**
> "Volunteer relay mode: When relay mode is active, your device receives SOS messages from nearby victims and forwards them to the internet. Privacy: You cannot see SOS content, you carry encrypted data. Battery: Background BLE scanning may impact battery approximately 5 to 15 percent. Relay will automatically stop when battery drops below 20 percent. You can stop anytime."

---

## 5. SOS Durum Açıklamaları (Kullanıcı İçin)

### 5.1 Türkçe

| Durum | Açıklama (Kullanıcı Dostu) | Ekran Okuyucu |
|-------|---------------------------|---------------|
| CİHAZDA KAYITLI | "Mesajınız cihazınızda kaydedildi, yakındaki cihaz aranıyor" | "SOS durumu: Cihazda kayıtlı. Mesajınız cihazınızda kaydedildi, yakındaki cihaz aranıyor." |
| YAKIN CİHAZA AKTARILDI | "Yakındaki bir cihaz aldı, internete ulaşması bekleniyor" | "SOS durumu: Yakın cihaza aktarıldı. Yakındaki bir cihaz aldı, internete ulaşması bekleniyor." |
| SUNUCUYA ULAŞTI | "Sunucuya ulaştı, operatör paneline düştü" | "SOS durumu: Sunucuya ulaştı. Sunucuya ulaştı, operatör paneline düştü." |
| OPERATÖR GÖRDÜ | "Operatör gördü" | "SOS durumu: Operatör gördü." |
| VAKA İŞLEME ALINDI | "Vaka işlemde" | "SOS durumu: Vaka işlemde." |

---

### 5.2 İngilizce

| Durum | Açıklama (Kullanıcı Dostu) | Ekran Okuyucu |
|-------|---------------------------|---------------|
| CİHAZDA KAYITLI (SAVED_LOCALLY) | "Message saved locally, searching for nearby device" | "SOS status: Saved locally. Message saved locally, searching for nearby device." |
| YAKIN CİHAZA AKTARILDI (PEER_RECEIVED) | "Received by nearby device, waiting for internet" | "SOS status: Peer received. Received by nearby device, waiting for internet." |
| SUNUCUYA ULAŞTI (SERVER_ACCEPTED) | "Reached server, visible to operators" | "SOS status: Server accepted. Reached server, visible to operators." |
| OPERATÖR GÖRDÜ (OPERATOR_SEEN) | "Operator viewed" | "SOS status: Operator viewed." |
| VAKA İŞLEME ALINDI (CASE_IN_PROGRESS) | "Case in progress" | "SOS status: Case in progress." |

---

## 6. Büyük Yazı Modunda Kısaltma Kuralları

**Kural:** Ekran okuyucu veya büyük yazı (200% font scaling) modunda kısaltmalar açılmalı.

| Kısaltma | Tam Hali (TR) | Tam Hali (EN) |
|----------|---------------|---------------|
| SOS | "SOS" (zaten evrensel) | "SOS" |
| BLE | "Bluetooth Low Energy" | "Bluetooth Low Energy" |
| GPS | "Konum" | "Location" |
| API | "Sunucu" (teknik olmayan) | "Server" |
| AI | "Yapay Zeka Önerisi" | "Artificial Intelligence Suggestion" |

---

## 7. Erişilebilirlik Kontrol Listesi

- ✅ Her uyarı/izin metni ekran okuyucu etiketi ile
- ✅ Buton dokunma alanı ≥48dp (Android) / 44pt (iOS)
- ✅ Kontrast oranı ≥4.5:1 (WCAG AA)
- ✅ Büyük yazı modunda (200%) metin taşmıyor
- ✅ Kırmızı/yeşil renk körü ayırımı yok; ikona + metne dayanıyor
- ✅ Animasyon `prefers-reduced-motion` için kapatılabilir

---

## 8. Yasak İfadeler (Asla Kullanılmaz)

| Yasak İfade | Neden Yasak | Doğru Alternatif |
|-------------|-------------|------------------|
| "Gönderildi" | Belirsiz | "Yakın cihaza aktarıldı" veya "Sunucuya ulaştı" |
| "Teslim edildi" | Fiziksel teslim varmış gibi | "Operatör gördü" |
| "Okundu" | OPERATOR_SEEN haricinde kanıtsız | "Operatör gördü" |
| "Ekip yolda" | Fiziksel müdahale garantisi yok | — (asla kullanma) |
| "Güvendesiniz" | Yanlış güvence | — (asla kullanma) |
| "Başarıyla iletildi" | Hangi adıma? | Spesifik durum ("Sunucuya ulaştı") |
| "Garantili teslimat" | Best-effort, garanti yok | — (asla kullanma) |

---

## 9. Sonraki Adımlar

- **ADIM 04:** Bu metinleri design tokens ve content-tr.json/content-en.json'a entegre et
- **ADIM 12:** Android izin akışlarında bu metinleri kullan
- **ADIM 13:** SOS ekranlarında durum açıklamalarını uygula
- **ADIM 21:** Panel onboarding'inde operatör için uyarı ver (AI otorite değil)
- **ADIM 31:** iOS için aynı metinlerin İngilizce localization dosyasına eklenmesi

---

**Not:** Bu doküman canlıdır; kullanıcı testi (ADIM 55) sonrası sade dil/açıklık açısından gözden geçirilecek.
