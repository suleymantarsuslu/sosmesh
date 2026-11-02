# Yasal Acil Durum Erişimi Politikası (Taslak)

**Durum:** Operasyonel taslak — `hukuki inceleme: NOT_TESTED`.

## Amaç

Can ve mal güvenliği tehditlerinde, yetkili kamu kurumlarının taleplerine yanıt verirken veri minimizasyonunu korumak.

## İlkeler

1. **Yetki doğrulama:** Resmî yazılı talep, mahkeme kararı veya kanuni zorunluluk belgesi olmadan toplu veri export yapılmaz.
2. **Kapsam sınırı:** Talep yalnızca ilgili `incidentId` / `messageId` ile sınırlandırılır.
3. **Kayıt:** Her erişim `PRIVACY_EXPORT` veya org onaylı audit action ile loglanır; koordinat ve SOS metni audit detayında redakte edilir.
4. **Acil bypass:** Operasyonel acil durumda COORDINATOR rolü export uçunu kullanabilir; olay sonrası 72 saat içinde yazılı gerekçe dosyalanır (süreç — NOT_TESTED).
5. **112 değildir:** SOSMesh resmî acil hattı değiştirmez; yasal süreçler 112/AFAD kanalları ile paralel yürütülür.

## Teknik uçlar

- Export: `GET /v1/operator/privacy/incidents/:incidentId/export` (COORDINATOR, ADMIN)
- Erase (yanlış veri / hak talebi): `POST /v1/operator/privacy/incidents/:incidentId/erase`

## Redaksiyon

`apps/api/src/privacy/audit-redaction.util.ts` — audit ve export bundle’da ham koordinat / SOS metni dönülmez.
