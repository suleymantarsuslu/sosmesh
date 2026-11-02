#!/usr/bin/env node
/**
 * Ensures docs/api/openapi.yaml matches generated NestJS Swagger output.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const specPath = path.join(repoRoot, 'docs', 'api', 'openapi.yaml');

console.log('=== OpenAPI freshness check ===');

if (!fs.existsSync(specPath)) {
  console.error('❌ Missing docs/api/openapi.yaml');
  process.exit(1);
}

const before = fs.readFileSync(specPath, 'utf8');

execSync('pnpm --filter @sosmesh/api openapi:generate', {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
    JWT_SECRET: process.env.JWT_SECRET ?? 'local-dev-jwt-secret-min-16',
    METRICS_SCRAPE_AUTH:
      process.env.METRICS_SCRAPE_AUTH ?? 'local-dev-metrics-scrape-token',
    NODE_ENV: 'test',
  },
});

const after = fs.readFileSync(specPath, 'utf8');
if (before.replace(/\r\n/g, '\n').trim() !== after.replace(/\r\n/g, '\n').trim()) {
  fs.writeFileSync(specPath, before, 'utf8');
  console.error('❌ docs/api/openapi.yaml is out of date (run pnpm --filter @sosmesh/api openapi:generate)');
  process.exit(1);
}

console.log('✅ OpenAPI spec is up to date');
