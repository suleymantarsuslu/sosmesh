import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { buildValidIngestRequest } from './helpers/build-ingest-packet';
import { runBackupRestoreDrill } from './helpers/backup-restore-drill';
import { getTestDatabaseUrl } from './helpers/database-url';
import {
  countPublicTables,
  runMigrationDown,
  runPrismaMigrateDeploy,
} from './helpers/embedded-postgres';
import { createTestApp } from './helpers/test-app';

describe('ADIM 49 backup, disaster read-only, migration rollback', () => {
  describe('disaster read-only mode', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.SOSMESH_DISASTER_READ_ONLY_MODE = 'true';
      app = await createTestApp(getTestDatabaseUrl());
    });

    afterAll(async () => {
      delete process.env.SOSMESH_DISASTER_READ_ONLY_MODE;
      await app.close();
    });

    it('blocks POST /v1/ingest with 503 while GET /health stays available', async () => {
      const ingestBody = buildValidIngestRequest({ messageId: 'disaster-readonly-msg' });
      const writeRes = await request(app.getHttpServer())
        .post('/v1/ingest')
        .send(ingestBody);
      expect(writeRes.status).toBe(503);
      expect(writeRes.body.code).toBe('DISASTER_READ_ONLY');

      const readRes = await request(app.getHttpServer()).get('/health');
      expect(readRes.status).toBe(200);
      expect(readRes.body.status).toBe('ok');
    });
  });

  describe('migration failure rollback', () => {
    it('leaves zero public tables after down following a failed DDL attempt', async () => {
      const databaseUrl = getTestDatabaseUrl();
      const tablesBeforeFail = await countPublicTables(databaseUrl);
      expect(tablesBeforeFail).toBe(19);

      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient({
        datasources: { db: { url: databaseUrl } },
      });
      try {
        await expect(
          prisma.$executeRawUnsafe('SELECT * FROM __adim49_nonexistent_syntax_error')
        ).rejects.toThrow();
      } finally {
        await prisma.$disconnect();
      }

      const tablesAfterFailedDdl = await countPublicTables(databaseUrl);
      expect(tablesAfterFailedDdl).toBe(19);

      runMigrationDown(databaseUrl);
      const afterDown = await countPublicTables(databaseUrl);
      expect(afterDown).toBe(0);

      runPrismaMigrateDeploy(databaseUrl);
      const afterUp = await countPublicTables(databaseUrl);
      expect(afterUp).toBe(19);
    });
  });

  describe('backup restore drill script', () => {
    it('encrypts dump, restores to staging schema, and matches counts', async () => {
      process.env.SOSMESH_BACKUP_ENCRYPTION_KEY = 'drill-test-key-material';
      const result = await runBackupRestoreDrill(getTestDatabaseUrl());
      expect(result.rowCount).toBe(50);
      expect(result.checksum).toHaveLength(32);
      expect(result.rpoMs).toBeGreaterThan(0);
      expect(result.rtoMs).toBeGreaterThan(0);
    });
  });
});
