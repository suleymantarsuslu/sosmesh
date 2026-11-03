#!/usr/bin/env node
/**
 * Regenerate SOSMesh launcher icons, favicons, and related branding assets
 * from branding/sosmesh-logo-source.png (1254×1254 RGB, dark navy background).
 *
 * Usage: node scripts/branding/generate-icons.mjs
 * Requires: sharp (root devDependency)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const SOURCE = path.join(REPO_ROOT, 'branding/sosmesh-logo-source.png');

/** Android adaptive icon safe zone: 66dp of 108dp. */
const ADAPTIVE_SAFE_RATIO = 66 / 108;

/** Launcher mask typically shows center 72dp of the 108dp foreground layer. */
const LAUNCHER_VISIBLE_RATIO = 72 / 108;

/** Master logo scale on the 108dp foreground canvas (fits pin inside 66dp safe circle). */
const ADAPTIVE_LOGO_SCALE = 0.62;

/** Soft alpha falloff on the outer portion of the scaled logo patch. */
const ADAPTIVE_EDGE_FEATHER = 0.12;

/** Maskable icon safe zone (~80% diameter). */
const MASKABLE_SAFE_RATIO = 0.8;

/** Filled at runtime from source corner pixels. */
let LAUNCHER_BACKGROUND = '#0A1530';

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

function rgbToHex(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Average RGB from small patches at all four corners of the master asset.
 */
async function sampleCornerBackground(sourcePath) {
  const meta = await sharp(sourcePath).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const patch = Math.max(4, Math.min(16, Math.floor(Math.min(w, h) * 0.01)));
  const corners = [
    { left: 0, top: 0 },
    { left: w - patch, top: 0 },
    { left: 0, top: h - patch },
    { left: w - patch, top: h - patch },
  ];
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let n = 0;
  for (const { left, top } of corners) {
    const { data, info } = await sharp(sourcePath)
      .extract({ left, top, width: patch, height: patch })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    for (let i = 0; i < data.length; i += channels) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      n += 1;
    }
  }
  return rgbToHex(
    Math.round(rSum / n),
    Math.round(gSum / n),
    Math.round(bSum / n)
  );
}

/**
 * Full-bleed cover with optional zoom-out (all pixels from source — no flat pad).
 * zoomOut > 1 pulls more margin from the master so the subject fits adaptive safe zones.
 */
function coverFromSource(source, size, zoomOut = 1) {
  if (zoomOut <= 1) {
    return sharp(source).resize(size, size, { fit: 'cover', position: 'centre' });
  }
  const cropSide = Math.round(size * zoomOut);
  const left = Math.floor((cropSide - size) / 2);
  const top = Math.floor((cropSide - size) / 2);
  return sharp(source)
    .resize(cropSide, cropSide, { fit: 'cover', position: 'centre' })
    .extract({ left, top, width: size, height: size });
}

function legacySquareIcon(source, size) {
  return coverFromSource(source, size, 1);
}

function roundLegacyIcon(source, size) {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
  return legacySquareIcon(source, size).composite([{ input: mask, blend: 'dest-in' }]);
}

function maskableWebIcon(source, size) {
  return coverFromSource(source, size, 1 / MASKABLE_SAFE_RATIO);
}

function buildFeatherAlphaMask(canvasSize, radiusPx, featherFraction) {
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const inner = radiusPx * (1 - featherFraction);
  const span = radiusPx - inner;
  const mask = Buffer.alloc(canvasSize * canvasSize);
  for (let y = 0; y < canvasSize; y += 1) {
    for (let x = 0; x < canvasSize; x += 1) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      let alpha = 0;
      if (dist <= inner) {
        alpha = 255;
      } else if (dist <= radiusPx && span > 0) {
        alpha = Math.round(255 * (1 - (dist - inner) / span));
      }
      mask[y * canvasSize + x] = alpha;
    }
  }
  return mask;
}

/**
 * Adaptive foreground: scaled logo (~62% canvas), edge-feathered to transparent so the
 * sampled background layer continues the art without a square seam.
 */
async function adaptiveForegroundLayer(source, size) {
  const logoSide = Math.round(size * ADAPTIVE_LOGO_SCALE);
  const pad = Math.floor((size - logoSide) / 2);
  const radius = logoSide / 2;

  const logoBuf = await sharp(source)
    .resize(logoSide, logoSide, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer();

  const { data, info } = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logoBuf, left: pad, top: pad }])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const feather = buildFeatherAlphaMask(size, radius, ADAPTIVE_EDGE_FEATHER);
  const pixels = info.width * info.height;
  for (let p = 0; p < pixels; p += 1) {
    const i = p * 4 + 3;
    data[i] = Math.round((data[i] * feather[p]) / 255);
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
}

/** Simulate adaptive icon as launchers draw it: bg + fg, circular mask at 72/108 diameter. */
async function renderLauncherVisiblePreview(foregroundPng, size, bgRgb) {
  const fgBuf = await sharp(foregroundPng).png().toBuffer();
  const visibleRadius = (size / 2) * LAUNCHER_VISIBLE_RATIO;
  const circleMask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${visibleRadius}" fill="white"/>
    </svg>`
  );

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: bgRgb,
    },
  })
    .composite([{ input: fgBuf }])
    .composite([{ input: circleMask, blend: 'dest-in' }]);
}

/**
 * Ensure opaque logo content fits inside the 66dp safe circle (and thus inside 72dp launcher mask).
 */
async function assertForegroundFitsSafeZone(foregroundPng, size) {
  const { data, info } = await sharp(foregroundPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  const cx = size / 2;
  const cy = size / 2;
  const safeRadius = (size / 2) * ADAPTIVE_SAFE_RATIO;
  let maxDist = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (alpha > 180) {
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (dist > maxDist) {
          maxDist = dist;
        }
      }
    }
  }
  if (maxX < minX) {
    throw new Error('Adaptive foreground has no visible pixels');
  }
  if (maxDist > safeRadius + 0.5) {
    throw new Error(
      `Adaptive foreground subject extends outside 66/108 safe circle (max radius ${maxDist.toFixed(1)} > ${safeRadius.toFixed(1)})`
    );
  }
}

async function validateAdaptiveForegroundAtXxxhdpi(resRoot, bgRgb) {
  const size = ANDROID_FOREGROUND_SIZES.xxxhdpi;
  const fgPath = path.join(resRoot, 'mipmap-xxxhdpi/ic_launcher_foreground.png');
  const fgPng = await fs.readFile(fgPath);
  await assertForegroundFitsSafeZone(fgPng, size);
  const preview = await renderLauncherVisiblePreview(fgPng, size, bgRgb);
  await writePng(path.join(REPO_ROOT, 'branding/adaptive-launcher-preview.png'), preview);
  console.log('Adaptive foreground safe-zone check passed (xxxhdpi)');
}

/** White silhouette on transparent for Android themed (monochrome) icon. */
async function monochromeForeground(source, size) {
  const fg = await adaptiveForegroundLayer(source, size);
  const silhouette = await fg
    .greyscale()
    .normalize()
    .threshold(40)
    .negate()
    .tint({ r: 255, g: 255, b: 255 })
    .toColourspace('srgb')
    .ensureAlpha()
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: silhouette }]);
}

/**
 * ICO container with embedded PNG payloads (Windows Vista+).
 * @param {{ width: number, height: number, png: Buffer }[]} images
 */
function encodeIco(images) {
  const count = images.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const parts = [];

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  parts.push(header);

  for (const { width, height, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    parts.push(entry);
    parts.push(png);
    offset += png.length;
  }

  return Buffer.concat(parts);
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
    await writePng(path.join(dir, 'ic_launcher.png'), legacySquareIcon(SOURCE, size));
    await writePng(path.join(dir, 'ic_launcher_round.png'), roundLegacyIcon(SOURCE, size));
  }

  for (const [density, size] of Object.entries(ANDROID_FOREGROUND_SIZES)) {
    const dir = path.join(resRoot, `mipmap-${density}`);
    await writePng(
      path.join(dir, 'ic_launcher_foreground.png'),
      await adaptiveForegroundLayer(SOURCE, size)
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
  await writePng(
    path.join(outDir, 'AppIcon-1024.png'),
    coverFromSource(SOURCE, 1024, 1).removeAlpha()
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

async function pngBufferCover(size) {
  return coverFromSource(SOURCE, size, 1).png().toBuffer();
}

async function writeWebManifest() {
  const manifestPath = path.join(REPO_ROOT, 'apps/web/app/manifest.ts');
  const body = `import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SOSMesh Operator Dashboard',
    short_name: 'SOSMesh',
    description: 'Emergency mesh network operator dashboard',
    start_url: '/operator/login',
    display: 'standalone',
    background_color: '${LAUNCHER_BACKGROUND}',
    theme_color: '${LAUNCHER_BACKGROUND}',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
`;
  await fs.writeFile(manifestPath, body);
}

async function writeSampledColorMeta() {
  const metaPath = path.join(REPO_ROOT, 'branding/sampled-background.json');
  await fs.writeFile(
    metaPath,
    `${JSON.stringify({ sampled_from: 'sosmesh-logo-source.png corner patches', hex: LAUNCHER_BACKGROUND }, null, 2)}\n`
  );
}

async function generateWeb() {
  const appDir = path.join(REPO_ROOT, 'apps/web/app');
  const publicIcons = path.join(REPO_ROOT, 'apps/web/public/icons');
  await ensureDir(publicIcons);

  const sizes16 = await pngBufferCover(16);
  const sizes32 = await pngBufferCover(32);
  const sizes48 = await pngBufferCover(48);
  const ico = encodeIco([
    { width: 16, height: 16, png: sizes16 },
    { width: 32, height: 32, png: sizes32 },
    { width: 48, height: 48, png: sizes48 },
  ]);
  await fs.writeFile(path.join(appDir, 'favicon.ico'), ico);

  await writePng(path.join(appDir, 'icon.png'), coverFromSource(SOURCE, 512, 1));
  await writePng(path.join(appDir, 'apple-icon.png'), coverFromSource(SOURCE, 180, 1));

  await writePng(path.join(publicIcons, 'icon-192.png'), coverFromSource(SOURCE, 192, 1));
  await writePng(path.join(publicIcons, 'icon-512.png'), coverFromSource(SOURCE, 512, 1));
  await writePng(
    path.join(publicIcons, 'icon-512-maskable.png'),
    maskableWebIcon(SOURCE, 512)
  );

  await writeWebManifest();
}

/** Audit contact sheet for seam review (regenerated each run). */
async function generateContactSheet() {
  const bg = parseHex(LAUNCHER_BACKGROUND);
  const panelSize = 320;
  const labels = [
    { title: 'iOS AppIcon 1024', path: 'apps/ios/SOSMesh/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png', thumb: 256 },
    {
      title: 'Android fg xxxhdpi',
      path: 'apps/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png',
      thumb: 256,
    },
    {
      title: 'Launcher visible 72dp',
      path: 'branding/adaptive-launcher-preview.png',
      thumb: 256,
    },
    {
      title: 'Android round xxxhdpi',
      path: 'apps/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png',
      thumb: 256,
    },
    {
      title: 'Web maskable 512',
      path: 'apps/web/public/icons/icon-512-maskable.png',
      thumb: 256,
    },
  ];

  const composites = [];
  let x = 0;
  for (const item of labels) {
    const abs = path.join(REPO_ROOT, item.path);
    const thumb = await sharp(abs)
      .resize(item.thumb, item.thumb, { fit: 'contain', background: bg })
      .png()
      .toBuffer();
    composites.push({ input: thumb, left: x + Math.floor((panelSize - item.thumb) / 2), top: 40 });
    x += panelSize;
  }

  const sheetWidth = panelSize * labels.length;
  const sheetHeight = panelSize + 20;
  await writePng(
    path.join(REPO_ROOT, 'branding/icon-regression-sheet.png'),
    sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 3,
        background: bg,
      },
    }).composite(composites)
  );
}

async function main() {
  const stat = await fs.stat(SOURCE).catch(() => null);
  if (!stat) {
    console.error(`Missing master asset: ${SOURCE}`);
    process.exit(1);
  }

  LAUNCHER_BACKGROUND = await sampleCornerBackground(SOURCE);
  console.log('Sampled launcher background:', LAUNCHER_BACKGROUND);
  const bgRgb = parseHex(LAUNCHER_BACKGROUND);

  for (const root of ANDROID_RES_ROOTS) {
    await generateAndroid(root);
  }
  await validateAdaptiveForegroundAtXxxhdpi(ANDROID_RES_ROOTS[0], bgRgb);
  await generateIos();
  await generateWeb();
  await writeSampledColorMeta();
  await generateContactSheet();

  console.log('Generated branding assets from', SOURCE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
