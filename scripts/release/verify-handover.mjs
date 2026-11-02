#!/usr/bin/env node
/**
 * ADIM 58 — validate docs/handover/final-report.md against docs/handover/status.json.
 * Usage: node scripts/release/verify-handover.mjs [--report path] [--status path]
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const VALID_STATUSES = new Set([
  'PASS',
  'PARTIAL',
  'FAIL',
  'BLOCKED_DEVICE',
  'BLOCKED_SECRET',
  'BLOCKED_APPROVAL',
  'NOT_TESTED',
  'NOT_STARTED',
  'PENDING_MERGE',
  'ACCEPTED_WITH_DEBT',
]);

const REQUIRED_GATE_NON_PASS = new Set([
  'PARTIAL',
  'FAIL',
  'BLOCKED_DEVICE',
  'BLOCKED_SECRET',
  'BLOCKED_APPROVAL',
  'NOT_TESTED',
  'NOT_STARTED',
  'PENDING_MERGE',
  'ACCEPTED_WITH_DEBT',
]);

const GITHUB_REPO_PREFIX = 'https://github.com/suleymantarsuslu/sosmesh';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function firstEvidencePath(step) {
  const ev = step.evidence;
  const list = Array.isArray(ev) ? ev : ev ? [String(ev)] : [];
  for (const item of list) {
    const s = String(item);
    if (/\.(ts|tsx|js|jsx|md|feature|sh|yaml|yml|json|csv|txt|png|log)$/i.test(s) || s.includes('/')) {
      return s.length > 100 ? `${s.slice(0, 97)}…` : s;
    }
  }
  return list[0] ? String(list[0]).slice(0, 100) : '—';
}

function formatDate(step) {
  if (!step.last_checked_at) {
    return '—';
  }
  return step.last_checked_at.replace(/\+.*$/, '').replace(/Z$/, 'Z');
}

function formatCommitRef(step) {
  if (!step.commit) {
    return '—';
  }
  if (step.commit === 'PLACEHOLDER_SHA') {
    return 'PLACEHOLDER_SHA (ADIM 56 dalı)';
  }
  if (step.commit.length === 40) {
    return step.commit.slice(0, 12);
  }
  return step.commit;
}

/** Build markdown table rows for ADIM 01–58 (status.json is source of truth). */
export function buildStepTableMarkdown(steps) {
  const lines = [
    '| ADIM | Başlık (kısa) | Durum | Tarih | Commit / PR | Kanıt |',
    '|------|----------------|-------|-------|-------------|-------|',
  ];
  for (const step of steps) {
    const title = step.title.length > 42 ? `${step.title.slice(0, 39)}…` : step.title;
    lines.push(
      `| ${step.id} | ${title} | ${step.status} | ${formatDate(step)} | ${formatCommitRef(step)} | ${firstEvidencePath(step)} |`,
    );
  }
  return lines.join('\n');
}

function parseReportStepStatuses(reportText) {
  const map = new Map();
  const rowRe =
    /^\|\s*(\d{2})\s*\|[^|]+\|\s*(PASS|PARTIAL|FAIL|BLOCKED_DEVICE|BLOCKED_SECRET|BLOCKED_APPROVAL|NOT_TESTED|NOT_STARTED|PENDING_MERGE|ACCEPTED_WITH_DEBT)\s*\|/gm;
  let m;
  while ((m = rowRe.exec(reportText)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

function extractUrls(text) {
  const urls = [];
  const re = /https?:\/\/[^\s)\]|>"']+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    urls.push(m[0].replace(/[.,;]+$/, ''));
  }
  return urls;
}

function urlAllowed(url) {
  if (url.startsWith(GITHUB_REPO_PREFIX)) {
    return true;
  }
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return true;
    }
    if (host.endsWith('.example') || host === 'example.com') {
      return true;
    }
    if (host.includes('todo_approval')) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function projectClaimsComplete(reportText) {
  const forbidden = [
    /\*\*Proje durumu:\*\*\s*Tamamlandı/i,
    /Proje\s+Tamamlandı/i,
    /#+\s*Tamamlandı\s*\(teslim/i,
    /SOSMesh\s+projesi\s+tamamlandı/i,
  ];
  return forbidden.some((re) => re.test(reportText));
}

/**
 * @param {{ repoRoot?: string, reportPath?: string, statusPath?: string }} opts
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function verifyHandover(opts = {}) {
  const root = opts.repoRoot ?? repoRoot;
  const reportPath = opts.reportPath ?? join(root, 'docs/handover/final-report.md');
  const statusPath = opts.statusPath ?? join(root, 'docs/handover/status.json');
  const errors = [];

  if (!existsSync(reportPath)) {
    return { ok: false, errors: [`Missing report: ${reportPath}`] };
  }
  if (!existsSync(statusPath)) {
    return { ok: false, errors: [`Missing status: ${statusPath}`] };
  }

  const status = readJson(statusPath);
  const report = readFileSync(reportPath, 'utf8');
  const steps = status.steps ?? [];

  if (steps.length !== 58) {
    errors.push(`status.json steps.length=${steps.length}, expected 58`);
  }

  const completion = status.project_completion;
  if (!completion || completion.status !== 'NOT_COMPLETE') {
    errors.push('status.json must set project_completion.status to NOT_COMPLETE');
  }

  const adim58 = steps.find((s) => s.id === '58');
  if (!adim58 || adim58.status !== 'PARTIAL') {
    errors.push('ADIM 58 in status.json must be PARTIAL');
  }

  const parsed = parseReportStepStatuses(report);
  for (const step of steps) {
    if (!VALID_STATUSES.has(step.status)) {
      errors.push(`Invalid status in status.json for ADIM ${step.id}: ${step.status}`);
    }
    const inReport = parsed.get(step.id);
    if (!inReport) {
      errors.push(`final-report.md missing table row for ADIM ${step.id}`);
      continue;
    }
    if (inReport !== step.status) {
      errors.push(
        `ADIM ${step.id} status mismatch: report=${inReport} status.json=${step.status}`,
      );
    }
    if (inReport === 'PASS' && step.status !== 'PASS') {
      errors.push(`ADIM ${step.id} shown PASS in report but status.json is ${step.status}`);
    }
  }

  for (const [id, st] of parsed) {
    if (st === 'PASS') {
      const step = steps.find((s) => s.id === id);
      if (step && step.status !== 'PASS') {
        errors.push(`Report PASS for ADIM ${id} but status.json is ${step.status}`);
      }
    }
  }

  const requiredSteps = steps.filter((s) => REQUIRED_GATE_NON_PASS.has(s.status));
  if (requiredSteps.length > 0 && projectClaimsComplete(report)) {
    errors.push('Report claims project Tamamlandı while required gates are non-PASS');
  }

  if (/\bTamamlandı\b/.test(report) && !/Tamamlandı.*yalnızca|sağlanmıyor|NOT_COMPLETE|Tamamlanmadı/i.test(report)) {
    if (projectClaimsComplete(report)) {
      errors.push('Forbidden Tamamlandı claim for project');
    }
  }

  for (const url of extractUrls(report)) {
    if (!urlAllowed(url)) {
      errors.push(`Disallowed URL in final-report.md: ${url}`);
    }
  }

  if (/https:\/\/demo\.|https:\/\/staging\.sosmesh|https:\/\/api\.sosmesh\.prod/i.test(report)) {
    errors.push('Invented production/demo URLs detected');
  }

  const expectedTable = buildStepTableMarkdown(steps);
  if (!report.includes('| 01 |') || !report.includes('| 58 |')) {
    errors.push('Report must include ADIM 01–58 progress table with id 01 and 58');
  }

  if (!report.includes('## Onay bekleyen eylemler')) {
    errors.push('Missing section: Onay bekleyen eylemler');
  }
  if (!report.includes('NOT EXECUTED') && !report.includes('UYGULANMADI')) {
    errors.push('Onay section must mark actions as NOT EXECUTED / UYGULANMADI');
  }
  if (!report.includes('Bağımsız temiz checkout')) {
    errors.push('Missing independent clean checkout section');
  }
  if (!report.includes('Copy-paste smoke')) {
    errors.push('Missing copy-paste smoke commands section');
  }

  if (!expectedTable.split('\n').every((line) => line.startsWith('|------') || report.includes(line) || line.startsWith('| ADIM'))) {
    const sample = steps.find((s) => s.id === '24');
    if (sample && !report.includes(`| 24 |`) && !report.includes(`| ${sample.id} |`)) {
      errors.push('ADIM 24 row missing from table');
    }
  }

  return { ok: errors.length === 0, errors };
}

function main() {
  const result = verifyHandover();
  if (result.ok) {
    console.log('verify-handover: OK');
    process.exit(0);
  }
  console.error('verify-handover: FAILED');
  for (const e of result.errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

import { pathToFileURL } from 'url';

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
