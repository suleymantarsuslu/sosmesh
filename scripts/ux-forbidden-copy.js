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
  'güvendesiniz',
  'çözüldü',
  'ekibe ulaştı',
  'yardım yolda',
  'kurtarma ekibi gördü',
  'operatör okudu',
];

const FORBIDDEN_EN = [
  'delivered',
  'read by',
  'help is on the way',
  'you are safe',
  'rescued',
  'resolved',
  'verified on real device',
  'real device verified',
  'ble test passed on hardware',
  'delivered to rescue',
];

// Simülasyon sonucunu gerçek cihaz kanıtı gibi sunmayı yasakla (ADIM 11)
const FORBIDDEN_SIMULATION_AS_DEVICE_TR = [
  'gerçek cihazda doğrulandı',
  'gerçek ble başarısı',
  'fiziksel cihazda test edildi'
];
const FORBIDDEN_SIMULATION_AS_DEVICE_EN = [
  'verified on real device',
  'real ble success',
  'tested on physical device'
];

// Context-specific bans (only in SOS status context)
const FORBIDDEN_IN_STATUS_CONTEXT_TR = ['tamamlandı'];
const FORBIDDEN_IN_STATUS_CONTEXT_EN = ['completed'];

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

function collectAndroidStringFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectAndroidStringFiles(full);
    } else if (entry.isFile() && entry.name === 'strings.xml') {
      FILES_TO_SCAN.push(full);
    }
  }
}

collectAndroidStringFiles('apps/android/feature-sos/src/main/res');
collectAndroidStringFiles('apps/android/feature-status/src/main/res');

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

// Context-specific scan (status context only)
function scanStatusContext(filePath, forbiddenList, lang) {
  if (!fs.existsSync(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const found = [];
  
  // Check if file contains status-related content
  const isStatusFile = content.toLowerCase().includes('status') || 
                       content.toLowerCase().includes('durum') ||
                       filePath.includes('status');
  
  if (!isStatusFile) return;
  
  const lowerContent = content.toLowerCase();
  forbiddenList.forEach(phrase => {
    if (lowerContent.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  });
  
  if (found.length > 0) {
    violations.push({
      file: filePath,
      lang: lang + ' (status context)',
      phrases: found
    });
  }
}

// TR dosyalarını tara
console.log('TR dosyaları taranıyor...');
FILES_TO_SCAN.filter(f => f.includes('-tr') || f.includes('prototypes'))
  .forEach(f => {
    scanFile(f, FORBIDDEN_TR, 'TR');
    scanFile(f, FORBIDDEN_SIMULATION_AS_DEVICE_TR, 'TR (simulation/device)');
  });

// EN dosyalarını tara
console.log('EN dosyaları taranıyor...');
FILES_TO_SCAN.filter(f => f.includes('-en') || f.includes('prototypes'))
  .forEach(f => {
    scanFile(f, FORBIDDEN_EN, 'EN');
    scanFile(f, FORBIDDEN_SIMULATION_AS_DEVICE_EN, 'EN (simulation/device)');
  });

// Lab matrix — yasak ifade örneklerini dokümanda literal yazma (ux-forbidden-copy tetiklenir)
FILES_TO_SCAN.forEach(f => scanStatusContext(f, FORBIDDEN_IN_STATUS_CONTEXT_TR, 'TR'));
FILES_TO_SCAN.forEach(f => scanStatusContext(f, FORBIDDEN_IN_STATUS_CONTEXT_EN, 'EN'));

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
