import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const statePath = process.argv[2];
if (!statePath) {
  process.exit(1);
}

async function bootOnce() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sosmesh-pg-'));
  const port = 15432 + Math.floor(Math.random() * 8000);
  const embedded = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
  });
  await embedded.initialise();
  await embedded.start();
  return { embedded, dataDir, port };
}

let embedded;
let dataDir;
let port;

try {
  ({ embedded, dataDir, port } = await bootOnce());
} catch (firstError) {
  try {
    ({ embedded, dataDir, port } = await bootOnce());
  } catch (secondError) {
    console.error(String(firstError));
    console.error(String(secondError));
    process.exit(1);
  }
}

const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
fs.writeFileSync(
  statePath,
  JSON.stringify({ dataDir, port, databaseUrl, pid: process.pid }),
  'utf8'
);

const shutdown = async () => {
  await embedded.stop();
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  fs.rmSync(statePath, { force: true });
  process.exit(0);
};

process.on('SIGTERM', () => {
  shutdown().catch(() => process.exit(1));
});
process.on('SIGINT', () => {
  shutdown().catch(() => process.exit(1));
});

await new Promise(() => {});
