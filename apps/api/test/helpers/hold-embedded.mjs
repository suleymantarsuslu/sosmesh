import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const statePath = process.argv[2];
if (!statePath) {
  process.exit(1);
}

function cleanupStaleDirs() {
  for (const entry of fs.readdirSync(os.tmpdir())) {
    if (entry.startsWith('sosmesh-pg-')) {
      const full = path.join(os.tmpdir(), entry);
      try {
        fs.rmSync(full, { recursive: true, force: true });
      } catch {
        // ignore busy temp dirs
      }
    }
  }
}

async function bootOnce(attempt) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `sosmesh-pg-a${attempt}-`));
  const port = 20000 + Math.floor(Math.random() * 15000);
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
let lastError;

cleanupStaleDirs();

for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    ({ embedded, dataDir, port } = await bootOnce(attempt));
    lastError = undefined;
    break;
  } catch (error) {
    lastError = error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
}

if (lastError) {
  console.error(String(lastError));
  process.exit(1);
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
