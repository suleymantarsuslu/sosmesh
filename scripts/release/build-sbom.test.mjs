#!/usr/bin/env node
/**
 * Lightweight regression test for lockfile SBOM builder (no pnpm list).
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const run = spawnSync(process.execPath, [join(__dirname, 'build-sbom.mjs')], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: { ...process.env, NODE_OPTIONS: '' },
});

if (run.status !== 0) {
  console.error(run.stderr || run.stdout);
  process.exit(run.status ?? 1);
}

const bom = JSON.parse(readFileSync(join(repoRoot, 'docs/release/sbom.cdx.json'), 'utf8'));
if (bom.bomFormat !== 'CycloneDX' || !Array.isArray(bom.components) || bom.components.length < 50) {
  console.error('SBOM output looks invalid or too small');
  process.exit(1);
}
const hasNext = bom.components.some((c) => c.name === 'next');
const hasNest = bom.components.some((c) => c.name === '@nestjs/core');
if (!hasNext || !hasNest) {
  console.error('Expected production deps next and @nestjs/core in SBOM');
  process.exit(1);
}
console.log(`build-sbom.test OK (${bom.components.length} components)`);
