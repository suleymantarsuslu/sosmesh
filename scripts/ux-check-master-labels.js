#!/usr/bin/env node
/**
 * SOSMesh Master Label Validator
 * Ensures 5 TR SOS status labels match master spec EXACTLY.
 * 
 * Master spec (immutable):
 *   1. CİHAZDA KAYITLI
 *   2. YAKIN CİHAZA AKTARILDI
 *   3. SUNUCUYA ULAŞTI
 *   4. OPERATÖR GÖRDÜ
 *   5. VAKA İŞLEME ALINDI
 * 
 * ADIM 04 — K1 requirement
 * Includes negative test mode: --negative-test
 */

const fs = require('fs');
const path = require('path');

const CONTENT_TR_PATH = path.join(__dirname, '../docs/ux/content-tr.json');
const NEGATIVE_TEST_MODE = process.argv.includes('--negative-test');

// Master spec (immutable)
const MASTER_LABELS_TR = [
  'CİHAZDA KAYITLI',
  'YAKIN CİHAZA AKTARILDI',
  'SUNUCUYA ULAŞTI',
  'OPERATÖR GÖRDÜ',
  'VAKA İŞLEME ALINDI',
];

function runNegativeTest() {
  console.log('🧪 Running NEGATIVE TEST: injecting wrong TR label...\n');
  
  const content = JSON.parse(fs.readFileSync(CONTENT_TR_PATH, 'utf-8'));
  const backup = JSON.stringify(content);
  
  // Inject wrong label
  content.status.timeline['5'] = 'VAKA İŞLEM SÜRÜYOR';  // Wrong!
  fs.writeFileSync(CONTENT_TR_PATH, JSON.stringify(content, null, 2));
  
  console.log('✓ Injected wrong label (status.5 = "VAKA İŞLEM SÜRÜYOR")');
  console.log('✓ Running validation (should FAIL)...\n');
  
  try {
    const result = runValidation();
    
    // Restore
    fs.writeFileSync(CONTENT_TR_PATH, backup);
    
    if (result.failures === 0) {
      console.error('\n❌ NEGATIVE TEST FAILED: Expected failures but got none!');
      process.exit(1);
    } else {
      console.log(`\n✅ NEGATIVE TEST PASSED: Correctly detected ${result.failures} mismatches`);
      console.log('✓ Restored original content-tr.json');
      process.exit(0);
    }
  } catch (err) {
    // Restore even on error
    fs.writeFileSync(CONTENT_TR_PATH, backup);
    throw err;
  }
}

function runValidation() {
  const content = JSON.parse(fs.readFileSync(CONTENT_TR_PATH, 'utf-8'));
  
  console.log('=== SOSMesh Master Label Validator ===\n');
  console.log('Checking 5 TR SOS status labels against master spec...\n');
  
  const labels = content.status.timeline;
  let failures = 0;
  
  for (let i = 0; i < 5; i++) {
    const key = String(i + 1);
    const actual = labels[key];
    const expected = MASTER_LABELS_TR[i];
    
    if (actual === expected) {
      console.log(`✅ Status ${key}: "${actual}"`);
    } else {
      console.log(`❌ Status ${key}:`);
      console.log(`   Expected: "${expected}"`);
      console.log(`   Actual:   "${actual}"`);
      failures++;
    }
  }
  
  if (failures === 0) {
    console.log('\n✅ All TR labels match master spec\n');
  } else {
    console.log(`\n❌ ${failures} label(s) do not match master spec\n`);
  }
  
  return { failures };
}

if (NEGATIVE_TEST_MODE) {
  runNegativeTest();
} else {
  const { failures } = runValidation();
  process.exit(failures > 0 ? 1 : 0);
}
