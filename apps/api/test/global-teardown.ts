import fs from 'node:fs';
import path from 'node:path';

import { dropCiTestDatabase } from './helpers/ci-postgres';
import { stopEmbeddedPostgres } from './helpers/embedded-postgres';

const envFile = path.join(__dirname, '.embedded-pg-env.json');

export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(envFile)) {
    return;
  }

  const parsed = JSON.parse(fs.readFileSync(envFile, 'utf8')) as {
    mode?: string;
    statePath?: string;
    databaseName?: string;
  };

  if (parsed.mode === 'ci' && parsed.databaseName) {
    const adminUrl = process.env.SOSMESH_CI_PG_ADMIN_URL;
    if (!adminUrl) {
      throw new Error(
        'SOSMESH_CI_PG_ADMIN_URL is required to drop CI test database'
      );
    }
    await dropCiTestDatabase(adminUrl, parsed.databaseName);
  } else if (parsed.statePath) {
    await stopEmbeddedPostgres(parsed.statePath);
  }

  fs.rmSync(envFile, { force: true });
}
