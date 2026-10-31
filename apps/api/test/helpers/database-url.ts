import fs from 'node:fs';
import path from 'node:path';

export function getTestDatabaseUrl(): string {
  const fromEnv = process.env.SOSMESH_TEST_DATABASE_URL;
  if (fromEnv) {
    return fromEnv;
  }
  const envFile = path.join(__dirname, '.embedded-pg-env.json');
  const { databaseUrl } = JSON.parse(fs.readFileSync(envFile, 'utf8')) as {
    databaseUrl: string;
  };
  return databaseUrl;
}
