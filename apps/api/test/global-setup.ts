import fs from 'node:fs';
import path from 'node:path';

import { createCiTestDatabase } from './helpers/ci-postgres';
import {
  runPrismaMigrateDeploy,
  startEmbeddedPostgres,
} from './helpers/embedded-postgres';

const envFile = path.join(__dirname, '.embedded-pg-env.json');

export default async function globalSetup(): Promise<void> {
  const adminUrl = process.env.SOSMESH_CI_PG_ADMIN_URL;
  const templateDatabaseUrl = process.env.SOSMESH_CI_DATABASE_URL;

  if (adminUrl && templateDatabaseUrl) {
    const created = await createCiTestDatabase(adminUrl, templateDatabaseUrl);
    runPrismaMigrateDeploy(created.databaseUrl);
    fs.writeFileSync(
      envFile,
      JSON.stringify({
        mode: 'ci',
        databaseUrl: created.databaseUrl,
        databaseName: created.databaseName,
      }),
      'utf8'
    );
    return;
  }

  if (adminUrl || templateDatabaseUrl) {
    throw new Error(
      'SOSMESH_CI_PG_ADMIN_URL and SOSMESH_CI_DATABASE_URL must both be set for CI PostgreSQL tests'
    );
  }

  try {
    const started = await startEmbeddedPostgres();
    runPrismaMigrateDeploy(started.databaseUrl);
    fs.writeFileSync(
      envFile,
      JSON.stringify({
        mode: 'embedded',
        databaseUrl: started.databaseUrl,
        statePath: started.statePath,
      }),
      'utf8'
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `No CI PostgreSQL env configured and embedded-postgres failed: ${message}`
    );
  }
}
