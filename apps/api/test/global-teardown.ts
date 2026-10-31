import fs from 'node:fs';
import path from 'node:path';

import { stopEmbeddedPostgres } from './helpers/embedded-postgres';

const envFile = path.join(__dirname, '.embedded-pg-env.json');

export default async function globalTeardown(): Promise<void> {
  if (fs.existsSync(envFile)) {
    const parsed = JSON.parse(fs.readFileSync(envFile, 'utf8')) as {
      statePath?: string;
    };
    if (parsed.statePath) {
      await stopEmbeddedPostgres(parsed.statePath);
    }
    fs.rmSync(envFile, { force: true });
  }
}
