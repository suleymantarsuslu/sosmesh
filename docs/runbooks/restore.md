# Restore ve PITR runbook (ADIM 49)

Bu belgedeki **RPO/RTO yalnızca otomatik restore drill logunda ölçülen değerlerdir**. Drill koşmadan hedef SLA uydurulmaz.

## Ölçüm ortamı

| Alan | Değer |
| --- | --- |
| Drill betiği | `scripts/backup-restore-drill.sh` |
| Tetikleyici | `apps/api/test/backup-adim49.spec.ts` (Jest) + CI `verify` job |
| PostgreSQL | GitHub Actions `postgres:16` + `postgresql-client-16` (`SOSMESH_CI_*`) veya yerel embedded Postgres (Jest `globalSetup`; `pg_dump`/`pg_restore` PATH'te olmalı) |
| Veri | Sentetik şema `sosmesh_drill_*`, PII yok; 50 satır + MD5 checksum |
| Yedekleme | `pg_dump -Fc` → AES-256-CBC şifreleme → kaynak şema DROP → şifre çöz → `pg_restore` (JSON satır kopyası değil) |
| Anahtar | Runtime `SOSMESH_BACKUP_ENCRYPTION_KEY` (secret adı: `SOSMESH_BACKUP_ENCRYPTION_KEY_SECRET_NAME`; repoda değer yok) |

## Ölçülen RPO / RTO

Drill log dosyası: `reports/backup-restore-drill.log` (CI artifact `test-reports`).

| Metrik | Tanım | Nereden okunur |
| --- | --- | --- |
| **RPO (ölçülen)** | Kaynak şema dump + şifreleme süresi (ms) | Log satırı `rpo_measured_ms=` veya `measured_rpo_ms=` |
| **RTO (ölçülen)** | Şifre çözme + staging şemaya restore + doğrulama süresi (ms) | Log satırı `rto_measured_ms=` veya `measured_rto_ms=` |

Son başarılı yerel/CI koşusundan örnek format (değerler ortama göre değişir):

```
PASS: backup-restore drill verified (RPO_ms=… RTO_ms=… env=ci_postgres|embedded_postgres tool=pg_dump/pg_restore)
measured_rpo_ms=…
measured_rto_ms=…
```

## Operasyon adımları (yerel / staging)

1. `infra/backup/backup.env.example` değişkenlerini secret manager’dan export edin (`SOSMESH_BACKUP_ENCRYPTION_KEY` repoya yazılmaz).
2. WAL: `postgresql.conf.fragment` + `infra/backup/scripts/archive-wal.sh`.
3. Base: `infra/backup/scripts/base-backup.sh` (`pg_basebackup`, şifreli tarball).
4. Rotasyon: `infra/backup/scripts/rotate-retention.sh`.
5. Tam restore: `infra/backup/scripts/restore-pitr.sh <boş_PGDATA>`; ardından gerekirse WAL replay (yalnızca arşiv etkin ortamda).

## Felaket modu (okuma açık, yazma kapalı)

- API: `SOSMESH_DISASTER_READ_ONLY_MODE=true` → yazma HTTP 503 (`DISASTER_READ_ONLY`), GET okuma devam eder.
- Test: `apps/api/test/backup-adim49.spec.ts`.

## Migration rollback

- Prisma `down.sql` zinciri: `apps/api/test/migration.spec.ts` ve `backup-adim49.spec.ts` (başarısız DDL sonrası down/up).

## Mobil protokol geri uyumluluk

- TS: `packages/contracts/src/protocol-version-rollout.test.ts`
- Kotlin: `packages/contracts-kotlin/.../ProtocolVersionRolloutTest.kt`
- Swift: `apps/ios/SOSMeshCore/Tests/.../ProtocolVersionRolloutTests.swift`
- BLE HELLO: `packages/ble-protocol/src/fuzz.test.ts` (version mismatch)
