#!/usr/bin/env node
/**
 * SOSMesh Yasak İfade Tarayıcı
 * content-*.json ve prototypes/ içinde yanlış umut veren ifadeleri tara
 */

const fs = require('fs');
const path = require('path');

console.log('=== SOSMesh Yasak İfade Tarayıcı ===\n');

// Yasak ifadeler
const FORBIDDEN_TR = [
  'okundu',
  'teslim edildi',
  'yardım geliyor',
  'kurtarılacaksınız',
  'güvendesiniz'
];

const FORBIDDEN_EN = [
  'delivered',
  'read by',
  'help is on the way',
  'you are safe',
  'rescued'
];

// Taranacak dosyalar
const FILES_TO_SCAN = [
  'docs/ux/content-tr.json',
  'docs/ux/content-en.json'
];

// prototypes/ altındaki tüm .html dosyaları
const PROTOTYPES_DIR = 'prototypes/ux';
if (fs.existsSync(PROTOTYPES_DIR)) {
  const prototypeFiles = fs.readdirSync(PROTOTYPES_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(PROTOTYPES_DIR, f));
  
  FILES_TO_SCAN.push(...prototypeFiles);
}

let violations = [];

// Tarama fonksiyonu
function scanFile(filePath, forbiddenList, lang) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${filePath} bulunamadı, atlanıyor`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
  const found = [];
  
  forbiddenList.forEach(phrase => {
    if (content.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  });
  
  if (found.length > 0) {
    violations.push({
      file: filePath,
      lang,
      phrases: found
    });
  }
}

// TR dosyalarını tara
console.log('TR dosyaları taranıyor...');
FILES_TO_SCAN.filter(f => f.includes('-tr') || f.includes('prototypes'))
  .forEach(f => scanFile(f, FORBIDDEN_TR, 'TR'));

// EN dosyalarını tara
console.log('EN dosyaları taranıyor...');
FILES_TO_SCAN.filter(f => f.includes('-en') || f.includes('prototypes'))
  .forEach(f => scanFile(f, FORBIDDEN_EN, 'EN'));

console.log('');

// Sonuçlar
if (violations.length > 0) {
  console.log(`❌ ${violations.length} dosyada yasak ifade bulundu:\n`);
  
  violations.forEach(v => {
    console.log(`📄 ${v.file} (${v.lang}):`);
    v.phrases.forEach(p => {
      console.log(`   - "${p}"`);
    });
    console.log('');
  });
  
  process.exit(1);
} else {
  console.log('✅ Yasak ifade bulunamadı');
  console.log(`Taranan dosya sayısı: ${FILES_TO_SCAN.length}`);
  process.exit(0);
}
