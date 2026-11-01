# SOSMesh Veri Haritası (ADIM 44)

Her satır: **amaç**, **erişim rolü**, **retention**, **silme yolu**.

| Veri alanı | Konum | Amaç | Erişim rolü | Retention | Silme yolu |
| --- | --- | --- | --- | --- | --- |
| SOS şifreli payload (`encryptedNoteBlob`, `encryptedPayloadRef`) | API DB `sos_messages` | Operatör triyajı (sunucu decrypt) | OPERATOR+ (tenant scope) | `RETENTION_SOS_MESSAGE_MAX_AGE_SECONDS` yapılandırılınca job | `POST .../privacy/incidents/:id/erase` veya retention purge |
| Envelope konumu (lat/lon, accuracy) | API DB | Harita / koordinasyon | OPERATOR+ | Aynı | Erase / retention; audit’te redakte |
| Operatör görünür metin (`operatorDisplayText`) | API DB | Demo/M0 sentetik etiket; prod’da kaynak politikası | OPERATOR+ | Aynı | Erase |
| Teslimat olayları (`message_events`) | API DB | Durum zaman çizelgesi | OPERATOR+ | Incident ile cascade | Erase |
| Röle makbuzları (`relay_receipts`) | API DB | Aktarım kanıtı (içerik yok) | OPERATOR+ | Incident cascade | Erase |
| AI analiz JSON | API DB | Öneri (karar operatörde) | OPERATOR+ | Incident cascade | Erase |
| Denetim izi (`audit_logs`) | API DB | Hesap verebilirlik | OPERATOR+ / export ADMIN+ | Org politikası (ADR-013) | Retention ayrı; detaylar redakte |
| Operatör feed | `operator_feed_events` | Canlı panel | OPERATOR+ | Mesaj ile | Retention / erase |
| Oturum / JWT | API bellek + cookie | Kimlik doğrulama | Self + ADMIN | Oturum süresi | Logout / token expiry |
| Cihaz kuyruğu (şifreli) | Android/iOS local | Offline iletim | Cihaz sahibi | Cihaz TTL (ADR-009) | Uygulama verisi temizleme |
| Röle tercihi | Android SharedPreferences | Opt-in durumu | Cihaz sahibi | Kullanıcı kontrolü | Ayarlardan kapatma |
| Demo seed | `prisma/seed.ts` | Geliştirme demo | Dev only | N/A | `pnpm` seed yeniden |

## Notlar

- Röle düğümü SOS **içeriğini okumaz** (ADR-009).
- Peer ACK, operatör “okundu” anlamına gelmez (`docs/transport/states.md`).
- Gerçek GPS/PII/sağlık verisi repoya ve CI loglarına yazılmaz.
