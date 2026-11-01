# Android TalkBack manual test script (ADIM 13)

**Sonuç:** NOT_TESTED (Cloud Agent ortamında fiziksel Android cihaz yok)

## Önkoşul

- TalkBack açık (Ayarlar → Erişilebilirlik → TalkBack)
- SOSMesh debug APK yüklü
- Sentetik test verisi (gerçek konum/not kullanmayın)

## Adımlar

1. Uygulamayı aç; ana ekranda **SOS gönder** düğmesine odaklan. TalkBack etiketini dinle (SOS CTA contentDescription).
2. SOS akışına gir; **Olay türü** chip’leri arasında gezin (radyo rolü).
3. Kişi sayısı alanına odaklan; geçersiz değerde hata metninin okunduğunu doğrula.
4. Konum izni kapalıyken **Konum bilinmiyor** metninin okunduğunu doğrula; akışın devam ettiğini kontrol et.
5. **Devam** → önizleme ekranı; **Onayla ve kaydet** ile kayıt.
6. **Mesaj durumu** ekranına git; zaman çizelgesi adımlarının yanlış umut vermediğini doğrula (peer ≠ kurtarma garantisi).
7. Kalıcı **112 yerine geçmez** uyarısının okunduğunu doğrula.

## Beklenen

- Tüm aksiyonlar ≥48dp dokunma alanı
- Yasak ifadeler duyulmaz (ekibe ulaştı, yardım yolda, vb.)

## Kanıt

- Fiziksel cihaz video/kayıt: **NOT_TESTED**
