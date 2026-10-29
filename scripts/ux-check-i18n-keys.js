#!/usr/bin/env node
/**
 * SOSMesh i18n Anahtar Eşitliği Kontrolü
 * content-tr.json ve content-en.json'daki anahtarların eşit olup olmadığını kontrol eder
 */

const fs = require('fs');
const path = require('path');

console.log('=== SOSMesh i18n Anahtar Eşitliği Kontrolü ===\n');

const TR_PATH = path.join(__dirname, '../docs/ux/content-tr.json');
const EN_PATH = path.join(__dirname, '../docs/ux/content-en.json');

// JSON dosyalarını oku
const trContent = JSON.parse(fs.readFileSync(TR_PATH, 'utf-8'));
const enContent = JSON.parse(fs.readFileSync(EN_PATH, 'utf-8'));

// Tüm anahtarları çıkar (nested)
function extractKeys(obj, prefix = '') {
  const keys = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

const trKeys = extractKeys(trContent).sort();
const enKeys = extractKeys(enContent).sort();

console.log(`TR anahtarları: ${trKeys.length}`);
console.log(`EN anahtarları: ${enKeys.length}`);
console.log('');

// Farkları bul
const missingInEN = trKeys.filter(k => !enKeys.includes(k));
const missingInTR = enKeys.filter(k => !trKeys.includes(k));

let exitCode = 0;

if (missingInEN.length > 0) {
  console.log(`❌ EN'de eksik anahtarlar (${missingInEN.length}):`);
  missingInEN.forEach(k => console.log(`   - ${k}`));
  console.log('');
  exitCode = 1;
}

if (missingInTR.length > 0) {
  console.log(`❌ TR'de eksik anahtarlar (${missingInTR.length}):`);
  missingInTR.forEach(k => console.log(`   - ${k}`));
  console.log('');
  exitCode = 1;
}

if (exitCode === 0) {
  console.log('✅ Tüm anahtarlar eşleşiyor');
  console.log(`Toplam anahtar sayısı: ${trKeys.length}`);
}

process.exit(exitCode);
