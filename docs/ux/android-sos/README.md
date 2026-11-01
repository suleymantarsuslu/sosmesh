# Android SOS UI screenshots (Robolectric)

**NOT real device screenshots.** These PNGs are captured from Robolectric Compose tests (`AndroidSosScreenshotCaptureTest`) at 360dp width with synthetic data (0,0 location placeholder).

Regenerate:

```bash
cd apps/android
./gradlew :feature-sos:testDebugUnitTest --tests "com.sosmesh.android.feature.sos.ui.AndroidSosScreenshotCaptureTest"
```

Filenames include `NOT_REAL_DEVICE` in the name.
