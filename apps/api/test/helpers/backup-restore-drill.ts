import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

const ALGO = 'aes-256-cbc';

function encryptBuffer(key: Buffer, plain: Buffer): Buffer {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  return Buffer.concat([iv, cipher.update(plain), cipher.final()]);
}

function decryptBuffer(key: Buffer, payload: Buffer): Buffer {
  const iv = payload.subarray(0, 16);
  const body = payload.subarray(16);
  const decipher = createDecipheriv(ALGO, key, iv);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export type BackupDrillResult = {
  rowCount: number;
  checksum: string;
  rpoMs: number;
  rtoMs: number;
  logLines: string[];
};

export async function runBackupRestoreDrill(databaseUrl: string): Promise<BackupDrillResult> {
  const schema = `sosmesh_drill_${Date.now()}_${process.pid}`;
  const stagingSchema = `${schema}_restore`;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const logLines: string[] = [];
  const log = (line: string) => {
    logLines.push(line);
  };

  try {
    const startBackup = Date.now();
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "${schema}".synthetic_rows (
        id serial PRIMARY KEY,
        payload text NOT NULL,
        checksum text NOT NULL
      )
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".synthetic_rows (payload, checksum)
      SELECT 'row-' || g, md5('row-' || g)
      FROM generate_series(1, 50) AS g
    `);

    const rowCountResult = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "${schema}".synthetic_rows`
    );
    const rowCount = Number(rowCountResult[0]?.count ?? 0);
    const checksumResult = await prisma.$queryRawUnsafe<{ sum: string }[]>(
      `SELECT md5(string_agg(checksum, '' ORDER BY id)) AS sum FROM "${schema}".synthetic_rows`
    );
    const checksum = checksumResult[0]?.sum ?? '';

    const rows = await prisma.$queryRawUnsafe<{ payload: string; checksum: string }[]>(
      `SELECT payload, checksum FROM "${schema}".synthetic_rows ORDER BY id`
    );
    const dumpJson = JSON.stringify({ schema, rows });
    const key = createHash('sha256')
      .update(process.env.SOSMESH_BACKUP_ENCRYPTION_KEY ?? 'drill-ephemeral-key')
      .digest();
    const encrypted = encryptBuffer(key, Buffer.from(dumpJson, 'utf8'));
    const rpoMs = Date.now() - startBackup;
    log(`source rows=${rowCount} checksum=${checksum} rpo_measured_ms=${rpoMs}`);

    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);

    const startRestore = Date.now();
    const decrypted = decryptBuffer(key, encrypted);
    const parsed = JSON.parse(decrypted.toString('utf8')) as {
      schema: string;
      rows: { payload: string; checksum: string }[];
    };
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${stagingSchema}"`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "${stagingSchema}".synthetic_rows (
        id serial PRIMARY KEY,
        payload text NOT NULL,
        checksum text NOT NULL
      )
    `);
    for (const row of parsed.rows) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${stagingSchema}".synthetic_rows (payload, checksum) VALUES (${sqlLiteral(row.payload)}, ${sqlLiteral(row.checksum)})`
      );
    }

    const restoreCountResult = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "${stagingSchema}".synthetic_rows`
    );
    const restoreCount = Number(restoreCountResult[0]?.count ?? 0);
    const restoreSumResult = await prisma.$queryRawUnsafe<{ sum: string }[]>(
      `SELECT md5(string_agg(checksum, '' ORDER BY id)) AS sum FROM "${stagingSchema}".synthetic_rows`
    );
    const restoreSum = restoreSumResult[0]?.sum ?? '';
    const rtoMs = Date.now() - startRestore;
    log(`restore rows=${restoreCount} checksum=${restoreSum} rto_measured_ms=${rtoMs}`);

    await prisma.$executeRawUnsafe(`DROP SCHEMA "${stagingSchema}" CASCADE`);

    if (rowCount !== restoreCount) {
      throw new Error(`row count mismatch ${rowCount} vs ${restoreCount}`);
    }
    if (checksum !== restoreSum) {
      throw new Error('checksum mismatch after restore');
    }

    return { rowCount, checksum, rpoMs, rtoMs, logLines };
  } finally {
    await prisma.$disconnect();
  }
}

export async function runBackupRestoreDrillCli(): Promise<number> {
  const repoRoot = path.join(__dirname, '..', '..', '..');
  const reportsDir = path.join(repoRoot, 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const logFile = path.join(reportsDir, 'backup-restore-drill.log');
  writeFileSync(logFile, '', 'utf8');

  const databaseUrl =
    process.env.SOSMESH_CI_DATABASE_URL ??
    process.env.DATABASE_URL ??
    '';
  if (!databaseUrl) {
    appendFileSync(logFile, 'FAIL: DATABASE_URL required\n');
    return 1;
  }
  if (!process.env.SOSMESH_BACKUP_ENCRYPTION_KEY) {
    process.env.SOSMESH_BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  }

  try {
    const result = await runBackupRestoreDrill(databaseUrl);
    const stamp = new Date().toISOString();
    for (const line of result.logLines) {
      appendFileSync(logFile, `[${stamp}] ${line}\n`);
    }
    appendFileSync(
      logFile,
      `[${stamp}] PASS: backup-restore drill verified (RPO_ms=${result.rpoMs} RTO_ms=${result.rtoMs} env=ci_or_embedded)\n`
    );
    appendFileSync(logFile, `measured_rpo_ms=${result.rpoMs}\n`);
    appendFileSync(logFile, `measured_rto_ms=${result.rtoMs}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendFileSync(logFile, `FAIL: ${message}\n`);
    return 1;
  }
}

if (require.main === module) {
  runBackupRestoreDrillCli().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}
