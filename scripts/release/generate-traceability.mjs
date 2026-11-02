#!/usr/bin/env node
/**
 * Build docs/release/traceability.json and traceability.md from status.json + step map + M0 feature.
 * Usage: node scripts/release/generate-traceability.mjs [--check]
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const checkOnly = process.argv.includes('--check');

function readJson(rel) {
  return JSON.parse(readFileSync(join(repoRoot, rel), 'utf8'));
}

function pathLike(s) {
  return /\.(ts|tsx|js|jsx|kt|swift|md|feature|sh|yaml|yml|json|csv)$/i.test(s) || s.includes('/');
}

function parseM0Scenarios(featureText) {
  const lines = featureText.split('\n');
  const scenarios = [];
  let pendingTags = [];
  for (const line of lines) {
    const tagMatch = line.match(/^\s*((?:@\S+\s*)+)$/);
    if (tagMatch) {
      pendingTags = tagMatch[1].trim().split(/\s+/);
      continue;
    }
    const scenMatch = line.match(/^\s*Senaryo:\s*(.+)$/);
    if (scenMatch) {
      const name = scenMatch[1].trim();
      const primaryTag =
        pendingTags.find((t) => /^@U[1-5]$/.test(t)) ??
        pendingTags.find((t) => t === '@M0') ??
        pendingTags[0] ??
        '@unknown';
      scenarios.push({ name, tags: [...pendingTags], primaryTag });
      pendingTags = [];
    }
  }
  return scenarios;
}

function deviceRequired(tags) {
  return tags.includes('@device-required');
}

function scenarioStatus(tags, step24Status) {
  if (deviceRequired(tags)) {
    return step24Status === 'PASS' ? 'PASS' : 'NOT_TESTED';
  }
  if (tags.includes('@post-m0')) {
    return 'NOT_TESTED';
  }
  return 'PARTIAL';
}

function normalizeEvidence(evidence) {
  if (!evidence) {
    return [];
  }
  if (Array.isArray(evidence)) {
    return evidence;
  }
  return [String(evidence)];
}

function mergeTests(stepId, evidence, mapEntry, m0Tests) {
  const tests = new Set();
  for (const ev of normalizeEvidence(evidence)) {
    if (pathLike(ev)) {
      tests.add(ev);
    }
  }
  for (const t of mapEntry?.tests ?? []) {
    tests.add(t);
  }
  for (const t of m0Tests ?? []) {
    tests.add(t);
  }
  return [...tests].sort();
}

function buildItems() {
  const status = readJson('docs/handover/status.json');
  const map = readJson('scripts/release/step-test-map.json');
  const feature = readFileSync(join(repoRoot, 'docs/tests/m0-acceptance.feature'), 'utf8');
  const scenarios = parseM0Scenarios(feature);
  const step24 = status.steps.find((s) => s.id === '24');
  const step24Status = step24?.status ?? 'NOT_TESTED';

  const items = [];

  for (const step of status.steps) {
    const mapEntry = map.steps?.[step.id] ?? {};
    const verificationStatus = step.status;
    items.push({
      id: `ADIM-${step.id}`,
      kind: 'master_plan_step',
      title: step.title,
      pass_criteria: step.pass_criteria,
      verification_status: verificationStatus,
      tier: step.tier,
      tests: mergeTests(step.id, step.evidence, mapEntry, null),
      evidence: {
        ci_jobs: mapEntry.ci_jobs ?? map.ci_jobs_default,
        report_paths: map.report_paths_default,
        document_paths: normalizeEvidence(step.evidence).filter(
          (e) => !pathLike(e) || e.endsWith('.md'),
        ),
        status_json_blockers: step.blockers ?? [],
      },
    });
  }

  for (const scen of scenarios) {
    const tagKey = scen.tags.find((t) => /^@U[1-5]$/.test(t) || t === '@M0');
    const m0Tests = tagKey ? map.m0_scenario_tests?.[tagKey] ?? [] : [];
    items.push({
      id: `M0-${scen.primaryTag.replace('@', '')}-${slug(scen.name)}`,
      kind: 'm0_acceptance_scenario',
      title: scen.name,
      feature_tags: scen.tags,
      pass_criteria: 'docs/tests/m0-acceptance.feature senaryosu',
      verification_status: scenarioStatus(scen.tags, step24Status),
      tests: mergeTests('24', [], {}, m0Tests),
      evidence: {
        ci_jobs: deviceRequired(scen.tags) ? [] : ['Verify Quality Gates'],
        report_paths: deviceRequired(scen.tags)
          ? ['docs/tests/m0-physical-report.md', 'evidence/m0/ (NOT_TESTED)']
          : ['docs/tests/traceability.md', 'reports/playwright-ux.log'],
        document_paths: ['docs/tests/m0-acceptance.feature'],
        status_json_blockers: deviceRequired(scen.tags) ? ['ADIM 24 fiziksel M0 NOT_TESTED (B-02)'] : [],
      },
    });
  }

  for (const g of map.geci_criteria ?? []) {
    items.push({
      id: g.id,
      kind: 'geci_criterion',
      title: g.criterion,
      source: g.source,
      pass_criteria: g.criterion,
      verification_status: g.verification_status,
      tests: g.tests ?? [],
      evidence: g.evidence,
    });
  }

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source_of_truth: 'docs/handover/status.json',
    item_count: items.length,
    items,
  };
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function renderMarkdown(doc) {
  const lines = [
    '# SOSMesh release traceability (ADIM 56)',
    '',
    '**Kaynak:** `docs/handover/status.json` + `docs/tests/m0-acceptance.feature` + GEÇTİ ölçütleri.',
    '',
    '**Kural:** Fiziksel cihaz, MacBook/Xcode, mağaza veya hukuki inceleme kanıtı gerektiren maddeler **asla PASS sayılmaz**; `verification_status` status.json ile uyumludur.',
    '',
    `**Üretim:** \`node scripts/release/generate-traceability.mjs\` — ${doc.generated_at}`,
    '',
    `**Kayıt sayısı:** ${doc.item_count} (58 ADIM + M0 senaryoları + GEÇTİ ölçütleri)`,
    '',
    '## Makine okunur çıktı',
    '',
    '- [`traceability.json`](./traceability.json)',
    '',
    '## Özet tablo (ADIM 01–58)',
    '',
    '| ID | Durum | Test / kanıt (kısa) |',
    '| --- | --- | --- |',
  ];

  for (const item of doc.items.filter((i) => i.kind === 'master_plan_step')) {
    const testHint = item.tests.slice(0, 2).join(', ') || '(doküman kanıtı)';
    lines.push(`| ${item.id} | **${item.verification_status}** | ${testHint} |`);
  }

  lines.push('', '## M0 senaryoları (@device-required → NOT_TESTED)', '');
  for (const item of doc.items.filter((i) => i.kind === 'm0_acceptance_scenario')) {
    lines.push(`- **${item.id}** (${item.verification_status}): ${item.title}`);
  }

  lines.push('', '## GEÇTİ ölçütleri', '');
  for (const item of doc.items.filter((i) => i.kind === 'geci_criterion')) {
    lines.push(`- **${item.id}** (${item.verification_status}): ${item.title} — \`${item.source}\``);
  }

  lines.push('', '## CI iş adları (Linux doğrulama)', '');
  lines.push('- `Verify Quality Gates` → `bash scripts/verify.sh`');
  lines.push('- `Android Gradle Build`, `Cross-Language Contract Tests`, `Load smoke (k6 profile 100)`, `Secret Scan`');
  lines.push('');
  return lines.join('\n');
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const doc = buildItems();
const jsonPath = join(repoRoot, 'docs/release/traceability.json');
const mdPath = join(repoRoot, 'docs/release/traceability.md');
const jsonText = `${JSON.stringify(doc, null, 2)}\n`;
const mdText = `${renderMarkdown(doc)}\n`;

function normalizeJsonForCheck(text) {
  const parsed = JSON.parse(text);
  delete parsed.generated_at;
  return JSON.stringify(parsed);
}

function normalizeMdForCheck(text) {
  return text.replace(/\*\*Üretim:\*\*[^\n]+\n/, '');
}

if (checkOnly) {
  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    console.error('Missing traceability outputs; run generate without --check');
    process.exit(1);
  }
  const onDiskJson = readFileSync(jsonPath, 'utf8');
  const onDiskMd = readFileSync(mdPath, 'utf8');
  if (sha256(normalizeJsonForCheck(onDiskJson)) !== sha256(normalizeJsonForCheck(jsonText))) {
    console.error('traceability.json is stale; run: node scripts/release/generate-traceability.mjs');
    process.exit(1);
  }
  if (sha256(normalizeMdForCheck(onDiskMd)) !== sha256(normalizeMdForCheck(mdText))) {
    console.error('traceability.md is stale; run: node scripts/release/generate-traceability.mjs');
    process.exit(1);
  }
  const adimCount = doc.items.filter((i) => i.kind === 'master_plan_step').length;
  if (adimCount !== 58) {
    console.error(`Expected 58 ADIM items, got ${adimCount}`);
    process.exit(1);
  }
  console.log('traceability outputs are fresh');
  process.exit(0);
}

writeFileSync(jsonPath, jsonText);
writeFileSync(mdPath, mdText);
console.log(`Wrote ${jsonPath} (${doc.item_count} items)`);
