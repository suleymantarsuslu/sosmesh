# API down (SosmeshApiDown)

## Belirtiler

- `/health/ready` 503 (`NOT_READY`, database unavailable)
- Prometheus: `sosmesh_health_database_up == 0`
- Operatör paneli health sayfası: `database: major_outage`

## İlk 15 dakika

1. Status page bileşenini `major_outage` olarak işaretleyin (bkz. `status-page.md`).
2. Postgres erişimini doğrulayın (`DATABASE_URL`, bağlantı limiti, disk).
3. API pod/process loglarında **PII içermeyen** yapılandırılmış event’lere bakın (`correlationId` ile filtre).
4. Gerekirse read-only moda geçin (ingest durdurma kararı operasyonel; otomatik silme yok).

## Kurtarma

- DB sağlıklı → `/health/ready` 200, gauge `sosmesh_health_database_up` 1.
- Alert `SosmeshApiDown` söner.
- Rollback gerekiyorsa `rollback.md` prosedürünü uygulayın.

## Kanıt

- CI: `observability-adim48.spec.ts` DB-down senaryosu gauge + alert recovery doğrular.
