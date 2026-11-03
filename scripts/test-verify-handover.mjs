#!/usr/bin/env node
/**
 * Negative + positive tests for verify-handover.mjs (node --test).
 */
import { mkdtempSync, writeFileSync, readFileSync, cpSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyHandover,
  buildStepTableMarkdown,
  buildProjectCompletionReason,
} from './release/verify-handover.mjs';

test('verify-handover passes on repo final-report and status', () => {
  const result = verifyHandover();
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('verify-handover fails when report upgrades ADIM 24 to PASS', () => {
  const dir = mkdtempSync(join(tmpdir(), 'handover-tamper-'));
  const statusPath = join(dir, 'status.json');
  const reportPath = join(dir, 'final-report.md');

  cpSync(join(process.cwd(), 'docs/handover/status.json'), statusPath);
  let report = readFileSync(join(process.cwd(), 'docs/handover/final-report.md'), 'utf8');
  report = report.replace(
    /\| 24 \|[^|]+\| NOT_TESTED \|/,
    '| 24 | M0 fiziksel | PASS |',
  );
  writeFileSync(reportPath, report);

  const status = JSON.parse(readFileSync(statusPath, 'utf8'));
  status.project_completion = {
    status: 'NOT_COMPLETE',
    reason: buildProjectCompletionReason(status.steps),
  };
  const s58 = status.steps.find((s) => s.id === '58');
  s58.status = 'PARTIAL';
  writeFileSync(statusPath, JSON.stringify(status));

  const result = verifyHandover({
    repoRoot: dir,
    reportPath,
    statusPath,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('24')));
});

test('verify-handover fails when project_completion.reason contradicts ADIM 50', () => {
  const dir = mkdtempSync(join(tmpdir(), 'handover-reason-'));
  const statusPath = join(dir, 'status.json');
  const reportPath = join(dir, 'final-report.md');

  cpSync(join(process.cwd(), 'docs/handover/status.json'), statusPath);
  cpSync(join(process.cwd(), 'docs/handover/final-report.md'), reportPath);

  const status = JSON.parse(readFileSync(statusPath, 'utf8'));
  status.project_completion.reason =
    'ADIM 49–50 NOT_STARTED; staging/prod deploy BLOCKED_APPROVAL';
  writeFileSync(statusPath, JSON.stringify(status));

  const result = verifyHandover({
    repoRoot: dir,
    reportPath,
    statusPath,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.includes('contradict') || e.includes('must match buildProjectCompletionReason'),
    ),
  );
});

test('buildStepTableMarkdown emits 58 data rows', () => {
  const status = JSON.parse(readFileSync(join(process.cwd(), 'docs/handover/status.json'), 'utf8'));
  const table = buildStepTableMarkdown(status.steps);
  const rows = table.split('\n').filter((l) => /^\| \d{2} \|/.test(l));
  assert.equal(rows.length, 58);
});
