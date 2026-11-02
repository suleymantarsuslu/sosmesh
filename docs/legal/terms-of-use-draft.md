# SOSMesh Kullanım Koşulları (Taslak)

**Durum:** Taslak — yayımlanmadan önce hukuki inceleme zorunludur (`hukuki inceleme: NOT_TESTED`).

## Önemli uyarı

SOSMesh **resmî acil servis (112) yerine geçmez**. Acil durumda yerel acil numarayı arayın.

## Hizmetin niteliği

- Deneysel acil durum haberleşme mesh prototipi
- Çevrimdışı BLE taşıma AI gerektirmez; sunucu/operatör yolu internet gerektirir
- Gönüllü röle yalnızca opt-in ile; röle düğümü SOS düz metnini okumaz
- Durum adımları (5 ACK seviyesi) teknik ilerlemeyi gösterir; **yardım veya operatör müdahalesi garantisi vermez**

## Kullanıcı yükümlülükleri

- Yanlış veya kötü niyetli SOS gönderimi yasaktır
- Röle modunu yalnızca bilinçli olarak ve pil/veri limitlerini kabul ederek açın
- Uygulama sınırlamalarını (Apple arka plan, force-quit, saat bağımsız mesh yok) kabul edersiniz

## Gizlilik

[`docs/legal/privacy-policy-draft.md`](privacy-policy-draft.md) ve [`docs/privacy/data-map.md`](../privacy/data-map.md).

## Destek iletişimi

Operatör paneli yardım sayfası ve destek formu: iletişim `DESTEK_ILETISIM_TBD` / `BLOCKED_APPROVAL`.

## Sorumluluk sınırı

Yazılım “olduğu gibi” sunulur; fiziksel cihaz saha testleri tamamlanmadan (`NOT_TESTED`) ticari veya hayati güvenlik iddiası yapılmaz.
