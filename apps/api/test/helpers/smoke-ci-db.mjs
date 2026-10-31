import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

const command = process.argv[2];
const statePath = process.argv[3];

async function createSmokeDatabase() {
  const adminUrl = process.env.SOSMESH_CI_PG_ADMIN_URL;
  const templateUrl = process.env.SOSMESH_CI_DATABASE_URL;
  if (!adminUrl || !templateUrl) {
    process.stderr.write(
      'SOSMESH_CI_PG_ADMIN_URL and SOSMESH_CI_DATABASE_URL are required\n'
    );
    process.exit(1);
  }
  if (!statePath) {
    process.exit(1);
  }

  const databaseName = `sosmesh_smoke_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const url = new URL(templateUrl);
  url.pathname = `/${databaseName}`;
  const databaseUrl = url.toString();

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

  fs.writeFileSync(
    statePath,
    JSON.stringify({ mode: 'ci', databaseName, databaseUrl }),
    'utf8'
  );
  process.stdout.write('CI PostgreSQL database ready for smoke\n');
}

async function dropSmokeDatabase() {
  if (!statePath || !fs.existsSync(statePath)) {
    return;
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (state.mode !== 'ci' || !state.databaseName) {
    return;
  }
  const adminUrl = process.env.SOSMESH_CI_PG_ADMIN_URL;
  if (!adminUrl) {
    process.stderr.write(
      'SOSMESH_CI_PG_ADMIN_URL is required to drop smoke database\n'
    );
    process.exit(1);
  }

  const databaseName = state.databaseName;
  const escaped = databaseName.replace(/"/g, '""');
  const { PrismaClient } = await import('@prisma/client');
  const admin = new PrismaClient({
    datasources: { db: { url: adminUrl } },
  });
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
  fs.rmSync(statePath, { force: true });
}

if (command === 'create') {
  await createSmokeDatabase();
} else if (command === 'drop') {
  await dropSmokeDatabase();
} else {
  process.exit(1);
}
