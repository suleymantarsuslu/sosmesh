#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..', '..');

function loadPgClient() {
  const apiRoot = join(repoRoot, 'apps', 'api');
  const searchRoots = [repoRoot, apiRoot];
  for (const root of searchRoots) {
    try {
      const pgPath = require.resolve('pg', { paths: [root] });
      return require(pgPath);
    } catch {
      continue;
    }
  }
  // pnpm: `pg` is often only linked under embedded-postgres (apps/api devDependency).
  try {
    const apiRequire = createRequire(join(apiRoot, 'package.json'));
    const embeddedEntry = apiRequire.resolve('embedded-postgres');
    const embeddedRequire = createRequire(embeddedEntry);
    const pgPath = embeddedRequire.resolve('pg');
    return require(pgPath);
  } catch {
    // fall through
  }
  throw new Error(
    'pg module not found under node_modules; run pnpm install --frozen-lockfile before bootstrap-pgclient'
  );
}

async function main() {
  const databaseUrl =
    process.env.SOSMESH_CI_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  if (!databaseUrl) {
    throw new Error('SOSMESH_CI_DATABASE_URL or DATABASE_URL is required');
  }
  const pg = loadPgClient();
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      "SELECT (current_setting('server_version_num')::int / 10000) AS major"
    );
    const major = Number(result.rows[0]?.major ?? 0);
    if (!Number.isFinite(major) || major <= 0) {
      throw new Error('unable to read PostgreSQL server major version');
    }
    process.stdout.write(String(major));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`detect-pg-server-major: ${message}\n`);
  process.exit(1);
});
