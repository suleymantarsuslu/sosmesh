import fs from 'node:fs';
import path from 'node:path';

import { runPrismaMigrateDeploy, startEmbeddedPostgres } from './helpers/embedded-postgres';

const envFile = path.join(__dirname, '.embedded-pg-env.json');

export default async function globalSetup(): Promise<void> {
  const started = await startEmbeddedPostgres();
  runPrismaMigrateDeploy(started.databaseUrl);
  fs.writeFileSync(envFile, JSON.stringify(started), 'utf8');
}
