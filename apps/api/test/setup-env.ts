import fs from 'node:fs';
import path from 'node:path';

import { applyTestAuthEnv } from './helpers/operator-auth';

const envFile = path.join(__dirname, '.embedded-pg-env.json');

if (fs.existsSync(envFile)) {
  const parsed = JSON.parse(fs.readFileSync(envFile, 'utf8')) as {
    databaseUrl: string;
    statePath?: string;
  };
  process.env.SOSMESH_TEST_DATABASE_URL = parsed.databaseUrl;
  process.env.DATABASE_URL = parsed.databaseUrl;
  if (parsed.statePath) {
    process.env.SOSMESH_PG_STATE_PATH = parsed.statePath;
  }
}

applyTestAuthEnv();
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
