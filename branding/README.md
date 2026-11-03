# SOSMesh branding assets

## Master source

| File | Dimensions | Notes |
|------|------------|--------|
| `sosmesh-logo-source.png` | 1254×1254 | RGB, opaque; official SOSMesh logo on `#0A1530` navy |

Do not edit derived launcher or favicon files by hand. Regenerate from the master with the script below.

## Regenerate derived assets

From the repository root (requires Node 20+ and `pnpm install`):

```bash
node scripts/branding/generate-icons.mjs
```

Dependencies: `sharp` and `to-ico` (root `devDependencies`).

## Generated outputs

### iOS (`apps/ios/SOSMesh/Assets.xcassets/AppIcon.appiconset/`)

| File | Size |
|------|------|
| `AppIcon-1024.png` | 1024×1024 (opaque RGB, square) |

### Android phone & Wear (`apps/android/app/…` and `apps/android/wear/…`)

Adaptive icon background color: `#0A1530` (`values/ic_launcher_colors.xml`).

| Asset | Densities / sizes |
|-------|-------------------|
| `mipmap-*/ic_launcher.png` | mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192 |
| `mipmap-*/ic_launcher_round.png` | same as legacy launcher |
| `mipmap-*/ic_launcher_foreground.png` | mdpi 108, hdpi 162, xhdpi 216, xxhdpi 324, xxxhdpi 432 |
| `mipmap-*/ic_launcher_monochrome.png` | same sizes as foreground (themed icon) |
| `mipmap-anydpi-v26/ic_launcher.xml` | adaptive icon definition |
| `mipmap-anydpi-v26/ic_launcher_round.xml` | round adaptive icon |

Foreground logo scale: 70% of the 108dp canvas (safe zone).

### Web (`apps/web/`)

| File | Size |
|------|------|
| `app/favicon.ico` | 16, 32, 48 px layers |
| `app/icon.png` | 512×512 |
| `app/apple-icon.png` | 180×180 |
| `public/icons/icon-192.png` | 192×192 |
| `public/icons/icon-512.png` | 512×512 |
| `public/icons/icon-512-maskable.png` | 512×512 (maskable safe zone) |

Web app manifest: `app/manifest.ts` (PWA icons reference `/icons/…`).
