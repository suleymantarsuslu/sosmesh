import { randomBytes } from 'node:crypto';

function sanitizeRunId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
}

export function buildCiTestDatabaseName(): string {
  const runId = sanitizeRunId(
    process.env.GITHUB_RUN_ID ?? process.env.CI ?? 'local'
  );
  const runner = sanitizeRunId(
    process.env.RUNNER_NAME ?? process.env.GITHUB_JOB ?? ''
  );
  const suffix = randomBytes(4).toString('hex');
  const parts = runner ? [runId, runner, suffix] : [runId, suffix];
  return `sosmesh_t_${parts.join('_')}`;
}

export function buildDatabaseUrlFromTemplate(
  templateUrl: string,
  databaseName: string
): string {
  const url = new URL(templateUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

export async function createCiTestDatabase(
  adminUrl: string,
  templateDatabaseUrl: string
): Promise<{ databaseName: string; databaseUrl: string }> {
  const databaseName = buildCiTestDatabaseName();
  const databaseUrl = buildDatabaseUrlFromTemplate(
    templateDatabaseUrl,
    databaseName
  );

  const { PrismaClient } = await import('@prisma/client');
  const admin = new PrismaClient({
    datasources: { db: { url: adminUrl } },
  });
  try {
    await admin.$executeRawUnsafe(
      `CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`
    );
  } finally {
    await admin.$disconnect();
  }

  return { databaseName, databaseUrl };
}

export async function dropCiTestDatabase(
  adminUrl: string,
  databaseName: string
): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const admin = new PrismaClient({
    datasources: { db: { url: adminUrl } },
  });
  const escaped = databaseName.replace(/"/g, '""');
  try {
    await admin.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${escaped.replace(/'/g, "''")}'
        AND pid <> pg_backend_pid()
    `);
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${escaped}"`);
  } finally {
    await admin.$disconnect();
  }
}
