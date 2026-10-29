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
const PROTOTYPES_DIR = path.join(__dirname, '../prototypes/ux');
const NEGATIVE_TEST_MODE = process.argv.includes('--negative-test');

// Master spec (immutable)
const MASTER_LABELS_TR = [
  'CİHAZDA KAYITLI',
  'YAKIN CİHAZA AKTARILDI',
  'SUNUCUYA ULAŞTI',
  'OPERATÖR GÖRDÜ',
  'VAKA İŞLEME ALINDI',
];

// Forbidden shortened labels
const FORBIDDEN_SHORTENED = [
  'Kayıtlı',
  'Aktarıldı',
  'Sunucuda',
  'Görüldü',
  'İşlemde',
];

function runNegativeTest() {
  console.log('🧪 Running NEGATIVE TEST: injecting shortened label in HTML...\n');
  
  // Find watch-sos.html and inject a shortened label
  const watchHtmlPath = path.join(PROTOTYPES_DIR, 'watch-sos.html');
  const originalHtml = fs.readFileSync(watchHtmlPath, 'utf-8');
  
  // Replace a master label with shortened version
  const modifiedHtml = originalHtml.replace('CİHAZDA<br/>KAYITLI', 'Kayıtlı');
  fs.writeFileSync(watchHtmlPath, modifiedHtml);
  
  console.log('✓ Injected shortened label in watch-sos.html ("Kayıtlı")');
  console.log('✓ Running validation (should FAIL)...\n');
  
  try {
    const result = runValidation();
    
    // Restore
    fs.writeFileSync(watchHtmlPath, originalHtml);
    
    if (result.failures === 0) {
      console.error('\n❌ NEGATIVE TEST FAILED: Expected failures but got none!');
      console.error('   Shortened labels should be detected!');
      process.exit(1);
    } else {
      console.log(`\n✅ NEGATIVE TEST PASSED: Correctly detected ${result.failures} violation(s)`);
      console.log('✓ Restored original watch-sos.html');
      process.exit(0);
    }
  } catch (err) {
    // Restore even on error
    fs.writeFileSync(watchHtmlPath, originalHtml);
    throw err;
  }
}

function runValidation() {
  const content = JSON.parse(fs.readFileSync(CONTENT_TR_PATH, 'utf-8'));
  
  console.log('=== SOSMesh Master Label Validator ===\n');
  console.log('Checking 5 TR SOS status labels against master spec...\n');
  
  const labels = content.status.timeline;
  let failures = 0;
  
  // Check JSON labels
  console.log('1. JSON Labels (content-tr.json):');
  for (let i = 0; i < 5; i++) {
    const key = String(i + 1);
    const actual = labels[key];
    const expected = MASTER_LABELS_TR[i];
    
    if (actual === expected) {
      console.log(`   ✅ Status ${key}: "${actual}"`);
    } else {
      console.log(`   ❌ Status ${key}:`);
      console.log(`      Expected: "${expected}"`);
      console.log(`      Actual:   "${actual}"`);
      failures++;
    }
  }
  
  // Check HTML prototypes for shortened labels
  console.log('\n2. HTML Prototypes (checking for shortened labels):');
  const htmlFiles = fs.readdirSync(PROTOTYPES_DIR).filter(f => f.endsWith('.html'));
  
  htmlFiles.forEach(file => {
    const filePath = path.join(PROTOTYPES_DIR, file);
    const html = fs.readFileSync(filePath, 'utf-8');
    
    // Check for forbidden shortened labels
    const foundShortened = [];
    FORBIDDEN_SHORTENED.forEach(shortened => {
      if (html.includes(shortened) && !html.includes('status-label')) {
        // If it's in status context but without proper markup, it's a violation
        const regex = new RegExp(`class="[^"]*status[^"]*"[^>]*>[^<]*${shortened}`, 'i');
        if (regex.test(html)) {
          foundShortened.push(shortened);
        }
      }
    });
    
    if (foundShortened.length > 0) {
      console.log(`   ❌ ${file}: Found shortened labels: ${foundShortened.join(', ')}`);
      failures++;
    } else {
      console.log(`   ✅ ${file}: No shortened labels`);
    }
  });
  
  console.log('');
  if (failures === 0) {
    console.log('✅ All TR labels match master spec (JSON + HTML)\n');
  } else {
    console.log(`❌ ${failures} violation(s) found\n`);
  }
  
  return { failures };
}

if (NEGATIVE_TEST_MODE) {
  runNegativeTest();
} else {
  const { failures } = runValidation();
  process.exit(failures > 0 ? 1 : 0);
}
