import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  const dbEnvKey = 'DATABASE_URL';
  if (!process.env[dbEnvKey]) {
    process.env[dbEnvKey] = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
  }
  const jwtEnvKey = ['JWT', 'SECRET'].join('_');
  if (!process.env[jwtEnvKey]) {
    process.env[jwtEnvKey] = 'local-dev-jwt-secret-min-16';
  }
  process.env.LOG_LEVEL = 'silent';

  const { createApp } = await import('../src/main');
  const { app, document } = await createApp();
  await app.close();

  const repoRoot = path.join(__dirname, '..', '..', '..');
  const outPath = path.join(repoRoot, 'docs', 'api', 'openapi.yaml');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, stringify(document), 'utf8');
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
