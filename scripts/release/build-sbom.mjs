#!/usr/bin/env node
/**
 * Build CycloneDX JSON SBOM from pnpm workspace tree (Linux CI, no secrets).
 * Output conforms to CycloneDX 1.4.
 */
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const outFile = join(repoRoot, 'docs/release/sbom.cdx.json');

function collectDeps(node, acc) {
  if (!node || typeof node !== 'object') {
    return;
  }
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const bucket = node[section];
    if (!bucket || typeof bucket !== 'object') {
      continue;
    }
    for (const [name, meta] of Object.entries(bucket)) {
      if (!meta || typeof meta !== 'object' || !meta.version) {
        continue;
      }
      const key = `${name}@${meta.version}`;
      if (!acc.has(key)) {
        acc.set(key, { name, version: meta.version, purl: `pkg:npm/${encodeURIComponent(name)}@${meta.version}` });
      }
      if (meta.dependencies) {
        collectDeps({ dependencies: meta.dependencies }, acc);
      }
    }
  }
}

const listFile = join(tmpdir(), `sosmesh-pnpm-list-${process.pid}.json`);
let tree;
try {
  execSync(`pnpm list -r --json --depth Infinity > "${listFile}"`, {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  tree = JSON.parse(readFileSync(listFile, 'utf8'));
} finally {
  try {
    unlinkSync(listFile);
  } catch {
    /* ignore */
  }
}

const depMap = new Map();
for (const pkg of tree) {
  collectDeps(pkg, depMap);
}

const components = [...depMap.values()]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((dep) => ({
    type: 'library',
    name: dep.name,
    version: dep.version,
    purl: dep.purl,
  }));

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.4',
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [
      {
        vendor: 'SOSMesh',
        name: 'scripts/release/build-sbom.mjs',
        version: '1.0.0',
      },
      {
        vendor: 'OWASP',
        name: '@cyclonedx/cyclonedx-library',
        version: '10.3.0',
      },
    ],
    component: {
      type: 'application',
      name: 'sosmesh-monorepo',
      version: '0.1.0',
    },
  },
  components,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(bom, null, 2)}\n`);
console.log(`Wrote CycloneDX SBOM: ${outFile} (${components.length} components)`);
