import { execSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const statePath = path.join(os.tmpdir(), 'sosmesh-pg-state.json');

async function waitForState(timeoutMs = 120000): Promise<{
  databaseUrl: string;
  port: number;
}> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(statePath)) {
      const raw = fs.readFileSync(statePath, 'utf8');
      const parsed = JSON.parse(raw) as { databaseUrl: string; port: number };
      if (parsed.databaseUrl) {
        return parsed;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for embedded Postgres');
}

export async function startEmbeddedPostgres(): Promise<{
  databaseUrl: string;
  port: number;
}> {
  if (fs.existsSync(statePath)) {
    fs.rmSync(statePath, { force: true });
  }
  const script = path.join(__dirname, 'hold-embedded.mjs');
  const child = spawn('node', [script, statePath], {
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: true,
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk);
  });
  child.unref();
  return waitForState();
}

export async function stopEmbeddedPostgres(): Promise<void> {
  const script = path.join(__dirname, 'stop-embedded.mjs');
  spawnSync('node', [script, statePath], { stdio: 'ignore' });
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const apiRoot = path.join(__dirname, '..', '..');

export function runPrismaMigrateDeploy(databaseUrl: string): void {
  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

export function runMigrationDown(databaseUrl: string): void {
  const downPath = path.join(
    apiRoot,
    'prisma',
    'migrations',
    '20261031180000_init',
    'down.sql'
  );
  const sql = fs.readFileSync(downPath, 'utf8');
  execSync(`npx prisma db execute --stdin --url "${databaseUrl}"`, {
    cwd: apiRoot,
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export async function countPublicTables(databaseUrl: string): Promise<number> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('_prisma_migrations')
    `;
    return Number(rows[0]?.count ?? 0);
  } finally {
    await prisma.$disconnect();
  }
}
