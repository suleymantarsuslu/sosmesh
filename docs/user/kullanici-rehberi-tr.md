# SOSMesh Kullanıcı Rehberi (Türkçe)

**Sürüm:** ADIM 57 taslak  
**Durum:** Belge hazır; fiziksel cihaz saha doğrulaması `NOT_TESTED`

---

## Bu uygulama resmî acil servisin (112) yerine geçmez

SOSMesh deneysel bir acil durum mesh iletişim prototipidir. **Acil durumda 112’yi (veya ülkenizdeki resmî acil numarayı) arayın.** Uygulama içi durum güncellemeleri yalnızca teknik iletim bilgisidir; yardım, müdahale veya operatör yanıtı **garanti edilmez**.

---

## Çevrimdışı kullanım

| Konu | Açıklama |
| --- | --- |
| **Ne çalışır?** | SOS kaydı cihazınızda şifreli kuyrukta saklanır; yakındaki cihazlara BLE ile aktarım denenir (**AI gerekmez**). |
| **Ne çalışmaz?** | İnternet yokken sunucuya ve operatör paneline ulaşım yoktur; peer ACK sunucu onayı değildir. |
| **Beklenti** | Mesh menzil, kalabalık, bina yapısı ve pil durumuna bağlıdır; sürekli arka plan bağlantısı **garanti edilmez**. |

---

## İzinler

| İzin | Neden | Reddedilirse |
| --- | --- | --- |
| **Bluetooth** | Yakın cihaz keşfi ve aktarım | Yakın aktarım durur; kayıt cihazda kalır |
| **Konum (Android tarama)** | BLE tarama politikası (Android 12+) | Tarama kısıtlanır |
| **Bildirimler** | Ön plan mesh bildirimi (Android 13+) | Kullanıcı bilgilendirmesi azalır |

İzin ekranından veya sistem ayarlarından düzeltin. Detay: [`docs/android/permission-guide.md`](../android/permission-guide.md).

---

## Gönüllü röle (opt-in)

- **Varsayılan:** Kapalı.
- **Ne yaparsınız?** Şifreli paketleri internete taşımaya gönüllü olursunuz.
- **Gizlilik:** Röle düğümü **SOS düz metnini ve konumu okumaz**; yalnızca şifreli zarf taşır.
- **Pil / veri:** Limitler uygulanır; düşük pilde röle duraklatılabilir.
- **Kapatma:** Ayarlardan veya röle ekranından istediğiniz zaman kapatabilirsiniz.

---

## Eşli telefon ile saat (Wear OS / watchOS)

| Platform | Davranış |
| --- | --- |
| **Wear OS** | Saat SOS’u eşli telefona iletir; telefon sunucu yolunu dener. Saat **bağımsız mesh garantisi yoktur**. |
| **watchOS** | SOS çoğunlukla eşli iPhone üzerinden; telefon erişilemezse kuyruk/bekleme — **sunucuya ulaştı iddiası yoktur**. |

Saat reboot, düşük güç ve bağlantı kopması senaryoları: [`docs/tests/watchos-matrix.md`](../tests/watchos-matrix.md) (`NOT_TESTED` cihaz kanıtı).

---

## Beş ACK / durum seviyesi

Durum zaman çizelgesi **teknik iletim basamaklarını** gösterir:

| Seviye | Anlam (kullanıcı) | **Ne demek değildir?** |
| --- | --- | --- |
| 1 — Cihazda kayıtlı | SOS cihazınızda güvenli kuyrukta | Operatör veya ekip gördü |
| 2 — Yakın cihaza aktarıldı | Başka bir cihaz paketi aldı (peer) | **Peer ACK = operatör okudu** değildir |
| 3 — Sunucuya ulaştı | İnternet yolu ingest kabul etti | Otomatik kurtarma başladı |
| 4 — Operatör gördü | Panelde görüntülendi | Müdahale veya SLA taahhüdü |
| 5 — Vaka işlemde | Operatör iş akışına aldı | Yardım yolda garantisi |

---

## Başarısız iletimde ne yapmalı?

1. **112’yi arayın** — uygulama alternatif değildir.
2. **Mesaj durumu** ekranında son hata koduna bakın (varsa).
3. **Bluetooth ve izinleri** kontrol edin; uygulamayı force-quit etmeyin (özellikle iOS).
4. **Yakın cihaz / röle:** Başka SOSMesh kullanıcısı veya gönüllü röle yoksa iletim bekleyebilir.
5. **Tekrar deneme:** Aynı olay için gereksiz çoklu SOS spam oluşturmayın; operatör yükünü artırır.
6. **İnternet gelince:** Kuyruk sunucuya yüklemeyi dener; garanti yoktur.

---

## Sorun giderme

| Belirti | Olası neden | Öneri |
| --- | --- | --- |
| “Yakın cihaz yok” | Menzil, BT kapalı, izin | BT açın, açık alana çıkın |
| Sunucuya ulaşmıyor | İnternet yok, röle kapalı | Wi‑Fi/mobil veri; gönüllü röle (opt-in) |
| Durum takılı kaldı | Arka plan kısıtı (Apple) | Uygulamayı ön planda tutun; force-quit sonrası mesh durabilir |
| Röle kapandı | Düşük pil / güç tasarrufu | Şarj; SOS kaydı cihazda kalır |

---

## Bilinen sınırlamalar

- **Apple:** Arka plan BLE ve force-quit sonrası davranış **garanti edilmez** (`docs/research/ios-multihop.md`).
- **Saat:** Bağımsız mesh / 7×24 röle **desteklenmez** iddiası yoktur.
- **Gerçek cihaz testleri:** Android 12–16, iOS fiziksel matris — **`NOT_TESTED`** (simülatör/emülatör PASS sayılmaz).
- **Mağaza sürümü:** Play / App Store / TestFlight başvurusu — **`BLOCKED_APPROVAL`**.

---

## Gizlilik ve destek

- Gizlilik taslağı: [`docs/legal/privacy-policy-draft.md`](../legal/privacy-policy-draft.md)
- Kullanım koşulları taslağı: [`docs/legal/terms-of-use-draft.md`](../legal/terms-of-use-draft.md)
- Güvenlik açığı: [`SECURITY.md`](../../SECURITY.md) (`TODO_APPROVAL` e-posta)
- Operatör paneli yardım: web uygulamasında **Yardım** menüsü

---

## Uygulama içi metinler

Mobil yardım string kaynakları: [`mobile-help-strings.md`](mobile-help-strings.md).  
Ayrı bir tam ekran yardım UI’si henüz bağlanmadı; string’ler Settings / onboarding ile uyumludur.
