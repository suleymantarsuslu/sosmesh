#!/usr/bin/env node
/**
 * Build CycloneDX JSON SBOM from pnpm-lock.yaml (production dependency closure).
 * Parses package blocks directly so peer-variant keys are not lost (YAML merge would dedupe).
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const lockPath = join(repoRoot, 'pnpm-lock.yaml');
const outFile = join(repoRoot, 'docs/release/sbom.cdx.json');

const PACKAGE_KEY = /^(?<name>(?:@[^/]+\/[^@]+)|[^@/]+)@(?<ver>.+)$/;

function parsePackageKey(key) {
  const match = key.match(PACKAGE_KEY);
  if (!match?.groups) {
    throw new Error(`Invalid pnpm package key: ${key}`);
  }
  const version = match.groups.ver.split('(')[0];
  return { name: match.groups.name, version };
}

/**
 * @returns {Map<string, { dependencies: Record<string, string> }>}
 */
function parseSnapshotSection(lockText) {
  const lines = lockText.split('\n');
  const snapshots = new Map();
  let inSnapshots = false;
  let currentKey = null;
  let inDependencies = false;

  for (const line of lines) {
    if (line === 'snapshots:') {
      inSnapshots = true;
      continue;
    }
    if (!inSnapshots) {
      continue;
    }

    const topKey = line.match(/^  ('(?:[^'\\]|\\.)+'|"(?:[^"\\]|\\.)+"|[^:\s][^:]*):\s*(\{\})?\s*$/);
    if (topKey) {
      let raw = topKey[1];
      if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
        raw = raw.slice(1, -1);
      }
      currentKey = raw;
      snapshots.set(currentKey, { dependencies: {} });
      inDependencies = false;
      continue;
    }

    if (currentKey && line === '    dependencies:') {
      inDependencies = true;
      continue;
    }

    if (inDependencies && line.startsWith('      ') && !line.startsWith('        ')) {
      const depMatch = line.match(/^      (.+?):\s*(.+)$/);
      if (depMatch) {
        let depName = depMatch[1].trim();
        if (
          (depName.startsWith("'") && depName.endsWith("'")) ||
          (depName.startsWith('"') && depName.endsWith('"'))
        ) {
          depName = depName.slice(1, -1);
        }
        snapshots.get(currentKey).dependencies[depName] = depMatch[2].trim();
      }
      continue;
    }

    if (line.startsWith('    ') && !line.startsWith('      ')) {
      inDependencies = false;
    }
  }

  return snapshots;
}

function resolvePackageKey(name, versionRef, packageKeys) {
  const exact = `${name}@${versionRef}`;
  if (packageKeys.has(exact)) {
    return exact;
  }

  const baseVer = String(versionRef).split('(')[0];
  const basePrefix = `${name}@${baseVer}`;
  let best = null;
  for (const key of packageKeys) {
    if (key === basePrefix || key.startsWith(`${basePrefix}(`)) {
      if (!best || key.length > best.length) {
        best = key;
      }
    }
  }
  if (best) {
    return best;
  }
  throw new Error(`Cannot resolve lockfile package: ${exact}`);
}

function collectProductionClosure(importers, packagesMap) {
  const packageKeys = new Set(packagesMap.keys());
  const visited = new Set();
  const queue = [];

  for (const importer of Object.values(importers ?? {})) {
    for (const section of ['dependencies', 'optionalDependencies']) {
      const bucket = importer[section];
      if (!bucket) {
        continue;
      }
      for (const [depName, entry] of Object.entries(bucket)) {
        if (!entry?.version || String(entry.version).startsWith('link:')) {
          continue;
        }
        queue.push(resolvePackageKey(depName, entry.version, packageKeys));
      }
    }
  }

  while (queue.length > 0) {
    const key = queue.pop();
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);
    const pkg = packagesMap.get(key);
    if (!pkg?.dependencies) {
      continue;
    }
    for (const [depName, depVer] of Object.entries(pkg.dependencies)) {
      queue.push(resolvePackageKey(depName, depVer, packageKeys));
    }
  }

  return visited;
}

function buildComponents(visitedKeys) {
  const depMap = new Map();
  for (const key of visitedKeys) {
    const { name, version } = parsePackageKey(key);
    const id = `${name}@${version}`;
    if (!depMap.has(id)) {
      depMap.set(id, {
        name,
        version,
        purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
      });
    }
  }
  return [...depMap.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

function uuidFromSha256(hex) {
  const h = hex.padEnd(32, '0').slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(12, 15)}-a${h.slice(15, 18)}-${h.slice(18, 30)}`;
}

const lockText = readFileSync(lockPath, 'utf8');
const importers = parseYaml(lockText).importers;
const packagesMap = parseSnapshotSection(lockText);
const visited = collectProductionClosure(importers, packagesMap);
const components = buildComponents(visited);

const reproducibleSeed = createHash('sha256')
  .update(components.map((c) => c.purl).join('\n'))
  .digest('hex');

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.4',
  serialNumber: `urn:uuid:${uuidFromSha256(reproducibleSeed)}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [
      {
        vendor: 'SOSMesh',
        name: 'scripts/release/build-sbom.mjs',
        version: '2.0.0',
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
    properties: [
      {
        name: 'sosmesh:sbom:source',
        value: 'pnpm-lock.yaml snapshots production closure',
      },
      {
        name: 'sosmesh:sbom:component_count',
        value: String(components.length),
      },
    ],
  },
  components: components.map((dep) => ({
    type: 'library',
    name: dep.name,
    version: dep.version,
    purl: dep.purl,
  })),
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(bom, null, 2)}\n`);
console.log(
  `Wrote CycloneDX SBOM: ${outFile} (${components.length} production components from lockfile)`,
);
