#!/usr/bin/env node
/**
 * Regenerate SOSMesh launcher icons, favicons, and related branding assets
 * from branding/sosmesh-logo-source.png (1254×1254 RGB, dark navy background).
 *
 * Usage: node scripts/branding/generate-icons.mjs
 * Requires: sharp, to-ico (root devDependencies)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const SOURCE = path.join(REPO_ROOT, 'branding/sosmesh-logo-source.png');

/** Sampled from master asset corners / edge fill. */
const LAUNCHER_BACKGROUND = '#0A1530';

/** Logo scale on 108dp adaptive foreground canvas (66dp safe zone ≈ 61%). */
const ADAPTIVE_FOREGROUND_SCALE = 0.7;

const ANDROID_LEGACY_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const ANDROID_FOREGROUND_SIZES = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

const ANDROID_RES_ROOTS = [
  path.join(REPO_ROOT, 'apps/android/app/src/main/res'),
  path.join(REPO_ROOT, 'apps/android/wear/src/main/res'),
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writePng(outPath, pipeline) {
  await ensureDir(path.dirname(outPath));
  await pipeline.png({ compressionLevel: 9 }).toFile(outPath);
}

function scaledLogoPipeline(source, size, scale = 1) {
  const inner = Math.round(size * scale);
  return sharp(source)
    .resize(inner, inner, { fit: 'contain', background: LAUNCHER_BACKGROUND })
    .extend({
      top: Math.floor((size - inner) / 2),
      bottom: Math.ceil((size - inner) / 2),
      left: Math.floor((size - inner) / 2),
      right: Math.ceil((size - inner) / 2),
      background: LAUNCHER_BACKGROUND,
    });
}

function squareLauncher(source, size) {
  return sharp(source).resize(size, size, { fit: 'cover', position: 'centre' });
}

function roundLauncher(source, size) {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
  return squareLauncher(source, size).composite([{ input: mask, blend: 'dest-in' }]);
}

function adaptiveForeground(source, size) {
  return scaledLogoPipeline(source, size, ADAPTIVE_FOREGROUND_SCALE);
}

/** White silhouette on transparent for Android themed (monochrome) icon. */
async function monochromeForeground(source, size) {
  const inner = Math.round(size * ADAPTIVE_FOREGROUND_SCALE);
  const grey = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .greyscale()
    .normalize()
    .png()
    .toBuffer();

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const pad = Math.floor((size - inner) / 2);
  const whiteSilhouette = await sharp(grey)
    .threshold(40)
    .negate()
    .tint({ r: 255, g: 255, b: 255 })
    .toColourspace('srgb')
    .ensureAlpha()
    .toBuffer();

  return canvas.composite([{ input: whiteSilhouette, left: pad, top: pad }]);
}

async function writeAndroidAdaptiveXml(resRoot) {
  const dir = path.join(resRoot, 'mipmap-anydpi-v26');
  await ensureDir(dir);
  const launcherXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
  const roundXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
  await fs.writeFile(path.join(dir, 'ic_launcher.xml'), launcherXml);
  await fs.writeFile(path.join(dir, 'ic_launcher_round.xml'), roundXml);
}

async function writeAndroidColors(resRoot) {
  const valuesDir = path.join(resRoot, 'values');
  await ensureDir(valuesDir);
  const colorsPath = path.join(valuesDir, 'ic_launcher_colors.xml');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${LAUNCHER_BACKGROUND}</color>
</resources>
`;
  await fs.writeFile(colorsPath, xml);
}

async function generateAndroid(resRoot) {
  await writeAndroidColors(resRoot);
  await writeAndroidAdaptiveXml(resRoot);

  for (const [density, size] of Object.entries(ANDROID_LEGACY_SIZES)) {
    const dir = path.join(resRoot, `mipmap-${density}`);
    await writePng(path.join(dir, 'ic_launcher.png'), squareLauncher(SOURCE, size));
    await writePng(path.join(dir, 'ic_launcher_round.png'), roundLauncher(SOURCE, size));
  }

  for (const [density, size] of Object.entries(ANDROID_FOREGROUND_SIZES)) {
    const dir = path.join(resRoot, `mipmap-${density}`);
    await writePng(
      path.join(dir, 'ic_launcher_foreground.png'),
      adaptiveForeground(SOURCE, size)
    );
    await writePng(
      path.join(dir, 'ic_launcher_monochrome.png'),
      await monochromeForeground(SOURCE, size)
    );
  }
}

async function generateIos() {
  const outDir = path.join(
    REPO_ROOT,
    'apps/ios/SOSMesh/Assets.xcassets/AppIcon.appiconset'
  );
  const outFile = path.join(outDir, 'AppIcon-1024.png');
  await writePng(
    outFile,
    sharp(SOURCE).resize(1024, 1024, { fit: 'cover' }).removeAlpha()
  );

  const contents = {
    images: [
      {
        filename: 'AppIcon-1024.png',
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024',
      },
    ],
    info: { author: 'xcode', version: 1 },
  };
  await fs.writeFile(path.join(outDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);
}

function maskableIcon(size) {
  return scaledLogoPipeline(SOURCE, size, ADAPTIVE_FOREGROUND_SCALE * 0.85);
}

async function pngBuffer(size) {
  return sharp(SOURCE).resize(size, size, { fit: 'cover' }).png().toBuffer();
}

async function generateWeb() {
  const appDir = path.join(REPO_ROOT, 'apps/web/app');
  const publicIcons = path.join(REPO_ROOT, 'apps/web/public/icons');
  await ensureDir(publicIcons);

  const sizes16 = await pngBuffer(16);
  const sizes32 = await pngBuffer(32);
  const sizes48 = await pngBuffer(48);
  const ico = await toIco([sizes16, sizes32, sizes48]);
  await fs.writeFile(path.join(appDir, 'favicon.ico'), ico);

  await writePng(path.join(appDir, 'icon.png'), sharp(SOURCE).resize(512, 512, { fit: 'cover' }));
  await writePng(
    path.join(appDir, 'apple-icon.png'),
    sharp(SOURCE).resize(180, 180, { fit: 'cover' })
  );

  await writePng(path.join(publicIcons, 'icon-192.png'), sharp(SOURCE).resize(192, 192, { fit: 'cover' }));
  await writePng(path.join(publicIcons, 'icon-512.png'), sharp(SOURCE).resize(512, 512, { fit: 'cover' }));
  await writePng(path.join(publicIcons, 'icon-512-maskable.png'), maskableIcon(512));
}

async function main() {
  const stat = await fs.stat(SOURCE).catch(() => null);
  if (!stat) {
    console.error(`Missing master asset: ${SOURCE}`);
    process.exit(1);
  }

  for (const root of ANDROID_RES_ROOTS) {
    await generateAndroid(root);
  }
  await generateIos();
  await generateWeb();

  console.log('Generated branding assets from', SOURCE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
