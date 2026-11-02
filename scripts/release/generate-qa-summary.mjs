#!/usr/bin/env node
/**
 * Build docs/release/qa-summary.json (defect inventory + audit + blockers snapshot).
 * Usage: node scripts/release/generate-qa-summary.mjs [--check]
 */
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const checkOnly = process.argv.includes('--check');
const outPath = join(repoRoot, 'docs/release/qa-summary.json');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'reports',
  '.gradle',
]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx|js|jsx|kt|swift|md|yaml|yml|gradle|kts)$/i.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

function scanTodoFixme() {
  const files = walk(repoRoot);
  const findings = [];
  const patterns = [
    { re: /\bFIXME\b/g, kind: 'FIXME' },
    { re: /\bTODO\b(?!_APPROVAL)/g, kind: 'TODO' },
    { re: /\bTODO_APPROVAL\b/g, kind: 'TODO_APPROVAL' },
  ];
  for (const file of files) {
    const rel = relative(repoRoot, file);
    if (rel.startsWith('docs/release/qa-summary')) {
      continue;
    }
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const { re, kind } of patterns) {
        re.lastIndex = 0;
        if (re.test(lines[i])) {
          findings.push({
            id: `SCAN-${kind}-${findings.length + 1}`,
            severity: kind === 'TODO_APPROVAL' ? 'high' : 'medium',
            owner: 'TBD',
            file: rel,
            line: i + 1,
            summary: lines[i].trim().slice(0, 160),
            release_note: kind === 'TODO_APPROVAL' ? 'Requires user approval before prod' : null,
            workaround:
              kind === 'TODO_APPROVAL'
                ? 'Placeholder until operator configures prod contact/secrets'
                : 'Track in tech-debt; non-blocking for rc.1 CI',
          });
        }
      }
    }
  }
  return findings;
}

function npmAuditSummary() {
  try {
    const raw = execSync('pnpm audit --json', { cwd: repoRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    const parsed = JSON.parse(raw);
    const meta = parsed.metadata?.vulnerabilities ?? {};
    return {
      tool: 'pnpm audit',
      critical: meta.critical ?? 0,
      high: meta.high ?? 0,
      moderate: meta.moderate ?? 0,
      low: meta.low ?? 0,
      info: meta.info ?? 0,
      total: meta.total ?? 0,
      advisories_sample: Object.keys(parsed.advisories ?? {}).slice(0, 5),
    };
  } catch (err) {
    const stdout = err.stdout?.toString?.() ?? '';
    try {
      const parsed = JSON.parse(stdout);
      const meta = parsed.metadata?.vulnerabilities ?? {};
      return {
        tool: 'pnpm audit',
        critical: meta.critical ?? 0,
        high: meta.high ?? 0,
        moderate: meta.moderate ?? 0,
        low: meta.low ?? 0,
        info: meta.info ?? 0,
        total: meta.total ?? 0,
        note: 'pnpm audit exited non-zero when vulnerabilities exist',
      };
    } catch {
      return { tool: 'pnpm audit', error: 'audit command failed', detail: String(err.message ?? err) };
    }
  }
}

function openBlockersSnapshot() {
  const status = JSON.parse(readFileSync(join(repoRoot, 'docs/handover/status.json'), 'utf8'));
  const blockers = readFileSync(join(repoRoot, 'docs/blockers.md'), 'utf8');
  return {
    status_json_gate_h: status.gates?.H ?? null,
    adim_56_note: 'PARTIAL — device evidence and user approval pending',
    device_tests: ['ADIM 24 M0 physical NOT_TESTED', 'B-02 two Android phones', 'B-04 wearables'],
    apple_signing: ['B-06 Apple Developer / TestFlight BLOCKED_APPROVAL', 'B-13 Mac private worker for iOS build'],
    store_review: ['Play Internal / App Store Connect BLOCKED_APPROVAL (ADIM 51–53)'],
    legal_review: ['docs/legal/kvkk-gdpr-legal-review-checklist.md NOT_TESTED'],
    ai_spend_approval: ['B-07 production spend cap BLOCKED_APPROVAL'],
    deploy_approvals: ['Staging/prod deploy BLOCKED_APPROVAL (ADIM 54)'],
    metrics_prod_secret: ['METRICS_SCRAPE_AUTH prod secret BLOCKED_APPROVAL — see apps/api/src/config/env.schema.ts'],
    blockers_md_excerpt: blockers.split('\n').slice(0, 12),
  };
}

function buildDoc() {
  const scanned = scanTodoFixme();
  const criticalHigh = scanned.filter((f) => f.severity === 'critical' || f.severity === 'high');
  const audit = npmAuditSummary();
  const knownIssues = [
    {
      id: 'KI-ADIM24-M0',
      severity: 'critical',
      owner: 'TBD',
      summary: 'M0 physical two-Android E2E not executed (B-02 BLOCKED_DEVICE)',
      workaround: 'Sim + CI gates only until lab evidence uploaded',
    },
    {
      id: 'KI-METRICS-SCRAPE-AUTH',
      severity: 'high',
      owner: 'TBD',
      summary: 'Production METRICS_SCRAPE_AUTH not provisioned (metrics scrape blocked in prod)',
      workaround: 'Disable public scrape; operator health UI uses authenticated routes only',
    },
    {
      id: 'KI-MODEL-API-KEY',
      severity: 'high',
      owner: 'TBD',
      summary: 'MODEL_API_KEY validity not verified (B-05 BLOCKED_SECRET)',
      workaround: 'AI step skipped; ingest and operator case remain',
    },
  ];

  if ((audit.critical ?? 0) > 0 || (audit.high ?? 0) > 0) {
    knownIssues.push({
      id: 'KI-NPM-AUDIT',
      severity: audit.critical > 0 ? 'critical' : 'high',
      owner: 'TBD',
      summary: `pnpm audit reports critical=${audit.critical ?? 0} high=${audit.high ?? 0}`,
      workaround: 'Patch dependencies before prod; rc.1 documents counts honestly',
    });
  }

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    release_candidate: 'v1.0.0-rc.1',
    defect_inventory: {
      todo_fixme_scan: scanned,
      critical_high_unresolved: [...criticalHigh, ...knownIssues.filter((k) => k.severity !== 'medium')],
      medium_with_workaround: scanned.filter((f) => f.severity === 'medium'),
      known_issues: knownIssues,
    },
    npm_audit: audit,
    open_blockers_snapshot: openBlockersSnapshot(),
  };
}

function normalizeForCheck(obj) {
  const copy = structuredClone(obj);
  delete copy.generated_at;
  return JSON.stringify(copy);
}

const doc = buildDoc();
const text = `${JSON.stringify(doc, null, 2)}\n`;

if (checkOnly) {
  if (!existsSync(outPath)) {
    console.error('Missing qa-summary.json');
    process.exit(1);
  }
  const onDisk = readFileSync(outPath, 'utf8');
  if (createHash('sha256').update(normalizeForCheck(JSON.parse(onDisk))).digest('hex') !== createHash('sha256').update(normalizeForCheck(doc)).digest('hex')) {
    console.error('qa-summary.json is stale; run: node scripts/release/generate-qa-summary.mjs');
    process.exit(1);
  }
  console.log('qa-summary.json is fresh');
  process.exit(0);
}

writeFileSync(outPath, text);
console.log(`Wrote ${outPath}`);
