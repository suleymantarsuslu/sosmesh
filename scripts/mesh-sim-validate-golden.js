#!/usr/bin/env node
/**
 * Validates committed golden mesh trace JSON (environment=simulated, schema fields).
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const goldenPath = path.join(
  REPO,
  'tools/mesh-simulator/golden/example-trace-seed4242.json'
);

const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));

if (golden.environment !== 'simulated') {
  console.error('Golden trace must set environment=simulated');
  process.exit(1);
}

if (golden.schemaVersion !== 1) {
  console.error('Golden trace schemaVersion must be 1');
  process.exit(1);
}

if (golden.outcome !== 'COMPLETED') {
  console.error('Golden trace outcome must be COMPLETED for reference fixture');
  process.exit(1);
}

if (!Array.isArray(golden.timeline) || golden.timeline.length < 3) {
  console.error('Golden trace timeline too short');
  process.exit(1);
}

console.log('Golden mesh trace validated:', golden.scenario, 'seed', golden.seed);
