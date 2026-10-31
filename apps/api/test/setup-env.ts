import fs from 'node:fs';
import path from 'node:path';

const envFile = path.join(__dirname, '.embedded-pg-env.json');

if (fs.existsSync(envFile)) {
  const { databaseUrl } = JSON.parse(fs.readFileSync(envFile, 'utf8')) as {
    databaseUrl: string;
  };
  process.env.DATABASE_URL = databaseUrl;
  process.env.SOSMESH_TEST_DATABASE_URL = databaseUrl;
}

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-minimum-16';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
