#!/usr/bin/env node
/**
 * SOSMesh Kontrast Kontrolü
 * tokens.json'daki tüm metin/arka plan çiftleri için WCAG kontrast oranını hesaplar
 */

const fs = require('fs');
const path = require('path');

console.log('=== SOSMesh Kontrast Kontrolü ===\n');

const TOKENS_PATH = path.join(__dirname, '../packages/design-tokens/tokens.json');
const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));

// Hex → RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// RGB → Relative Luminance
function getLuminance(rgb) {
  const { r, g, b } = rgb;
  const [rs, gs, bs] = [r, g, b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Kontrast oranı
function getContrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  if (!rgb1 || !rgb2) return null;
  
  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

// Kontrol edilecek çiftler
const PAIRS = [
  // Light mode
  { name: 'Light: SOS button text/bg', mode: 'light', fg: 'text.onSos', bg: 'sos' },
  { name: 'Light: Danger text/bg', mode: 'light', fg: 'text.onDanger', bg: 'danger' },
  { name: 'Light: Success text/bg', mode: 'light', fg: 'text.onSuccess', bg: 'success' },
  { name: 'Light: Primary text/surface', mode: 'light', fg: 'text.primary', bg: 'surface.primary' },
  { name: 'Light: Secondary text/surface', mode: 'light', fg: 'text.secondary', bg: 'surface.primary' },
  { name: 'Light: Warning text/surface', mode: 'light', fg: 'text.primary', bg: 'warning' },
  
  // Dark mode
  { name: 'Dark: SOS button text/bg', mode: 'dark', fg: 'text.onSos', bg: 'sos' },
  { name: 'Dark: Danger text/bg', mode: 'dark', fg: 'text.onDanger', bg: 'danger' },
  { name: 'Dark: Success text/bg', mode: 'dark', fg: 'text.onSuccess', bg: 'success' },
  { name: 'Dark: Primary text/surface', mode: 'dark', fg: 'text.primary', bg: 'surface.primary' },
  { name: 'Dark: Secondary text/surface', mode: 'dark', fg: 'text.secondary', bg: 'surface.primary' },
  { name: 'Dark: Info text/surface', mode: 'dark', fg: 'text.primary', bg: 'info' }
];

// Renk değerini çöz
function resolveColor(path, mode) {
  const parts = path.split('.');
  let current = tokens.colors[mode];
  
  for (const part of parts) {
    current = current[part];
    if (!current) return null;
  }
  
  return current;
}

// Kontrol et
console.log('Kontrast Raporu:\n');
console.log('WCAG AA: Normal metin ≥4.5:1, Büyük metin/ikon ≥3:1\n');

const results = [];
let failures = 0;

PAIRS.forEach(pair => {
  const fgColor = resolveColor(pair.fg, pair.mode);
  const bgColor = resolveColor(pair.bg, pair.mode);
  
  if (!fgColor || !bgColor) {
    console.log(`⚠️  ${pair.name}: Renk bulunamadı (${pair.fg} / ${pair.bg})`);
    return;
  }
  
  const ratio = getContrastRatio(fgColor, bgColor);
  
  if (ratio === null) {
    console.log(`⚠️  ${pair.name}: Kontrast hesaplanamadı`);
    return;
  }
  
  const passNormal = ratio >= 4.5;
  const passLarge = ratio >= 3.0;
  
  const status = passNormal ? '✅' : (passLarge ? '⚠️' : '❌');
  
  console.log(`${status} ${pair.name}:`);
  console.log(`   FG: ${fgColor}, BG: ${bgColor}`);
  console.log(`   Oran: ${ratio.toFixed(2)}:1`);
  console.log(`   Normal metin: ${passNormal ? 'PASS' : 'FAIL'}`);
  console.log(`   Büyük metin/ikon: ${passLarge ? 'PASS' : 'FAIL'}`);
  console.log('');
  
  results.push({
    name: pair.name,
    ratio,
    passNormal,
    passLarge
  });
  
  if (!passNormal) {
    failures++;
  }
});

console.log('=== Özet ===');
console.log(`Toplam çift: ${results.length}`);
console.log(`Normal metin PASS: ${results.filter(r => r.passNormal).length}`);
console.log(`Normal metin FAIL: ${failures}`);

if (failures > 0) {
  console.log('\n❌ Bazı çiftler WCAG AA gereksinimlerini karşılamıyor');
  process.exit(1);
} else {
  console.log('\n✅ Tüm çiftler WCAG AA gereksinimlerini karşılıyor');
  process.exit(0);
}
