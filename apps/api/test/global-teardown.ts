import fs from 'node:fs';
import path from 'node:path';

import { stopEmbeddedPostgres } from './helpers/embedded-postgres';

const envFile = path.join(__dirname, '.embedded-pg-env.json');

export default async function globalTeardown(): Promise<void> {
  await stopEmbeddedPostgres();
  if (fs.existsSync(envFile)) {
    fs.rmSync(envFile, { force: true });
  }
}
