import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-jwt-secret-min-16';
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
