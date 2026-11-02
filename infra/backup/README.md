# SOSMesh PostgreSQL backup (ADIM 49)

Yerel geliştirme ve CI için sınırlı depolama; gerçek bulut veya ücretli servis yok.

## Bileşenler

| Dosya | Amaç |
| --- | --- |
| `backup.env.example` | Ortam değişkenleri; şifreleme anahtarı yalnızca `SOSMESH_BACKUP_ENCRYPTION_KEY` (secret adı: `SOSMESH_BACKUP_ENCRYPTION_KEY_SECRET_NAME`) |
| `postgresql.conf.fragment` | WAL arşivleme + `archive_command` |
| `scripts/archive-wal.sh` | WAL segmentini AES-256 ile şifreler, rotasyon uygular |
| `scripts/base-backup.sh` | `pg_basebackup` + şifreli arşiv |
| `scripts/rotate-retention.sh` | Base/WAL saklama limitleri |
| `scripts/restore-pitr.sh` | Son base yedeği boş `PGDATA` dizinine açar |

## Otomatik restore drill

CI ve `scripts/verify.sh` içinde `scripts/backup-restore-drill.sh` çalışır: sentetik şema, `pg_dump -Fc` → AES-256 şifreleme → kaynak şema DROP → `pg_restore` → satır sayısı/checksum doğrulama. Log: `reports/backup-restore-drill.log`. Yerelde `SOSMESH_CI_DATABASE_URL` yoksa verify adımı **NOT_TESTED** yazar; Jest embedded Postgres üzerinde aynı drill'i koşar (`postgresql-client` gerekir).

## Docker Compose

`infra/compose/docker-compose.yml` postgres servisine `postgresql.conf.fragment` mount edilmeden önce `SOSMESH_BACKUP_ENCRYPTION_KEY` ve `SOSMESH_BACKUP_STORAGE_DIR` volume tanımlayın. Repoda anahtar yoktur.

## Felaket modu (API)

`SOSMESH_DISASTER_READ_ONLY_MODE=true` iken yazma HTTP uçları 503 döner; GET (okuma) çalışır. Test: `apps/api/test/backup-adim49.spec.ts`.
