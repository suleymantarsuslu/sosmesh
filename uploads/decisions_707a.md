# SOSMesh — Karar Kaydı

## D-001 — Yeni, ayrı SOSMesh monorepo
- Karar: SOSMesh, yeni ve ayrı bir monorepo olarak kurulur (apps/web, api, android, ios, wearos, watchos; packages/contracts, fixtures, design-tokens; infra; docs; scripts — master §05).
- Önceki projelerden (ör. DRONIX, VARIS, PetCam, edavam_*, antiosoft*) **kod devşirilmez**; hassas veri taşınmaz.
- Gerekçe: temiz lisans/gizlilik sınırı, kanıt izlenebilirliği. Kanıt: GitHub'da SOSMesh repo yok (ADIM 01).
- Repo oluşturma kullanıcı onayına bağlıdır (B-01).
- Durum: Karar; uygulama onay bekliyor.

## D-002 — Grok→Cursor yolu: Cursor cloud agent; harcama onaya bağlı
- Karar: Kodlama Cursor cloud agent ile yürütülür (başlat / yanıt / rapor okuma). Yolun fiilen çalıştığı Grok tarafından doğrulanacak; çalışmazsa manuel copy-paste döngüsüne geçilir ve "otomatik" gibi sunulmaz.
- Bütçe/harcama/yeni ücretli kaynak, public push, prod deploy, DNS, mağaza başvurusu, anahtar rotasyonu **kullanıcı onayına bağlıdır**; bütçe limiti şu an bilinmiyor (B-07).
- Durum: Karar; doğrulama bekliyor.
