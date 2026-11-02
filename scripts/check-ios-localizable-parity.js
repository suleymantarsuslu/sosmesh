#!/usr/bin/env node
/**
 * SOSMesh iOS Localizable.strings TR ↔ EN anahtar eşitliği
 */

const fs = require('fs');
const path = require('path');

const TR_PATH = path.join(
  __dirname,
  '../apps/ios/SOSMesh/tr.lproj/Localizable.strings'
);
const EN_PATH = path.join(
  __dirname,
  '../apps/ios/SOSMesh/en.lproj/Localizable.strings'
);

function parseKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  const lineRe = /^"([^"\\]*(?:\\.[^"\\]*)*)"\s*=/;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }
    const match = trimmed.match(lineRe);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

console.log('=== SOSMesh iOS Localizable.strings parity ===\n');

const trKeys = parseKeys(TR_PATH);
const enKeys = parseKeys(EN_PATH);

console.log(`TR keys: ${trKeys.size}`);
console.log(`EN keys: ${enKeys.size}`);

const missingInEn = [...trKeys].filter((k) => !enKeys.has(k)).sort();
const missingInTr = [...enKeys].filter((k) => !trKeys.has(k)).sort();

let exitCode = 0;

if (missingInEn.length > 0) {
  console.log(`\n❌ EN missing (${missingInEn.length}):`);
  missingInEn.forEach((k) => console.log(`   - ${k}`));
  exitCode = 1;
}

if (missingInTr.length > 0) {
  console.log(`\n❌ TR missing (${missingInTr.length}):`);
  missingInTr.forEach((k) => console.log(`   - ${k}`));
  exitCode = 1;
}

if (exitCode === 0) {
  console.log('\n✅ TR and EN Localizable.strings keys match');
}

process.exit(exitCode);
