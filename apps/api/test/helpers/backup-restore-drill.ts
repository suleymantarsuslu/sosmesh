import { execFileSync, spawnSync } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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

type PgConn = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

function parsePgUrl(databaseUrl: string): PgConn {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
  };
}

function pgEnv(password: string): NodeJS.ProcessEnv {
  return { ...process.env, PGPASSWORD: password, LC_ALL: 'C', LANG: 'C' };
}

function resolvePgBinary(tool: 'pg_dump' | 'pg_restore'): string {
  const envKey = tool === 'pg_dump' ? 'SOSMESH_PG_DUMP_PATH' : 'SOSMESH_PG_RESTORE_PATH';
  const fromEnv = process.env[envKey];
  if (fromEnv) {
    return fromEnv;
  }
  const located = spawnSync('bash', ['-lc', `command -v ${tool}`], { encoding: 'utf8' });
  const bin = located.stdout.trim();
  if (located.status !== 0 || !bin) {
    throw new Error(
      `${tool} not found in PATH; install postgresql-client (e.g. postgresql-client-16) or set ${envKey}`
    );
  }
  return bin;
}

function parsePgToolMajor(versionOutput: string): number {
  const match = versionOutput.match(/(\d+)\./);
  const major = Number.parseInt(match?.[1] ?? '', 10);
  if (!Number.isFinite(major) || major <= 0) {
    throw new Error(`unable to parse PostgreSQL tool major from: ${versionOutput.trim()}`);
  }
  return major;
}

async function assertPgClientMajorGteServer(
  prisma: PrismaClient,
  pgDumpPath: string,
  pgRestorePath: string
): Promise<void> {
  const serverRows = await prisma.$queryRawUnsafe<{ major: number }[]>(
    `SELECT current_setting('server_version_num')::int / 10000 AS major`
  );
  const serverMajor = serverRows[0]?.major ?? 0;
  if (serverMajor <= 0) {
    throw new Error('unable to read PostgreSQL server major version');
  }
  const dumpMajor = parsePgToolMajor(
    execFileSync(pgDumpPath, ['--version'], { encoding: 'utf8' })
  );
  const restoreMajor = parsePgToolMajor(
    execFileSync(pgRestorePath, ['--version'], { encoding: 'utf8' })
  );
  if (dumpMajor < serverMajor) {
    throw new Error(
      `pg_dump major ${dumpMajor} is older than PostgreSQL server major ${serverMajor}; upgrade client tools`
    );
  }
  if (restoreMajor < serverMajor) {
    throw new Error(
      `pg_restore major ${restoreMajor} is older than PostgreSQL server major ${serverMajor}; upgrade client tools`
    );
  }
}

function runPgDump(
  conn: PgConn,
  schema: string,
  dumpPath: string,
  pgDump: string
): void {
  execFileSync(
    pgDump,
    [
      '-h',
      conn.host,
      '-p',
      conn.port,
      '-U',
      conn.user,
      '-d',
      conn.database,
      '-n',
      schema,
      '-Fc',
      '-f',
      dumpPath,
    ],
    { env: pgEnv(conn.password), stdio: 'pipe' }
  );
}

function runPgRestore(conn: PgConn, dumpPath: string, pgRestore: string): void {
  execFileSync(
    pgRestore,
    [
      '-h',
      conn.host,
      '-p',
      conn.port,
      '-U',
      conn.user,
      '-d',
      conn.database,
      '--no-owner',
      '--no-acl',
      '--single-transaction',
      dumpPath,
    ],
    { env: pgEnv(conn.password), stdio: 'pipe' }
  );
}

export type BackupDrillResult = {
  rowCount: number;
  checksum: string;
  rpoMs: number;
  rtoMs: number;
  logLines: string[];
  envLabel: string;
};

export async function runBackupRestoreDrill(databaseUrl: string): Promise<BackupDrillResult> {
  const schema = `sosmesh_drill_${Date.now()}_${process.pid}`;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const conn = parsePgUrl(databaseUrl);
  const pgDump = resolvePgBinary('pg_dump');
  const pgRestore = resolvePgBinary('pg_restore');
  const workDir = mkdtempSync(path.join(tmpdir(), 'sosmesh-drill-'));
  const dumpPath = path.join(workDir, 'source.custom');
  const encryptedPath = path.join(workDir, 'source.custom.enc');
  const logLines: string[] = [];
  const log = (line: string) => {
    logLines.push(line);
  };
  const envLabel = process.env.SOSMESH_CI_DATABASE_URL ? 'ci_postgres' : 'embedded_postgres';

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

    await assertPgClientMajorGteServer(prisma, pgDump, pgRestore);

    log(`pg_dump path=${pgDump} schema=${schema}`);
    runPgDump(conn, schema, dumpPath, pgDump);
    const dumpBytes = readFileSync(dumpPath);
    if (dumpBytes.length < 64) {
      throw new Error('pg_dump produced unexpectedly small output');
    }

    const key = createHash('sha256')
      .update(process.env.SOSMESH_BACKUP_ENCRYPTION_KEY ?? 'drill-ephemeral-key')
      .digest();
    const encrypted = encryptBuffer(key, dumpBytes);
    writeFileSync(encryptedPath, encrypted);
    const rpoMs = Date.now() - startBackup;
    log(`source rows=${rowCount} checksum=${checksum} rpo_measured_ms=${rpoMs} dump_bytes=${dumpBytes.length}`);

    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    const gone = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM information_schema.schemata WHERE schema_name = '${schema.replace(/'/g, "''")}'`
    );
    if ((gone[0]?.n ?? 0) !== 0) {
      throw new Error('source schema still present after DROP (simulated data loss failed)');
    }

    const startRestore = Date.now();
    const decrypted = decryptBuffer(key, readFileSync(encryptedPath));
    writeFileSync(dumpPath, decrypted);
    log(`pg_restore path=${pgRestore} target_db=${conn.database}`);
    runPgRestore(conn, dumpPath, pgRestore);

    const restoreCountResult = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "${schema}".synthetic_rows`
    );
    const restoreCount = Number(restoreCountResult[0]?.count ?? 0);
    const restoreSumResult = await prisma.$queryRawUnsafe<{ sum: string }[]>(
      `SELECT md5(string_agg(checksum, '' ORDER BY id)) AS sum FROM "${schema}".synthetic_rows`
    );
    const restoreSum = restoreSumResult[0]?.sum ?? '';
    const rtoMs = Date.now() - startRestore;
    log(`restore rows=${restoreCount} checksum=${restoreSum} rto_measured_ms=${rtoMs}`);

    if (rowCount !== restoreCount) {
      throw new Error(`row count mismatch ${rowCount} vs ${restoreCount}`);
    }
    if (checksum !== restoreSum) {
      throw new Error('checksum mismatch after pg_restore');
    }

    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);

    return { rowCount, checksum, rpoMs, rtoMs, logLines, envLabel };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
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
    appendFileSync(logFile, 'FAIL: DATABASE_URL or SOSMESH_CI_DATABASE_URL required\n');
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
      `[${stamp}] PASS: backup-restore drill verified (RPO_ms=${result.rpoMs} RTO_ms=${result.rtoMs} env=${result.envLabel} tool=pg_dump/pg_restore)\n`
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
