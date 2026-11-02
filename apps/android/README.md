# SOSMesh Android App

**Status:** ADIM 12 — iskelet, izin matrisi, Room outbox, CI unit/lint

## Tech stack

- Kotlin, Jetpack Compose, Navigation, **Hilt** (ADR-010)
- Room outbox (`OutboxQueueAdapter`), Coroutines-ready modules
- `packages/contracts-kotlin` as Gradle project dependency
- EncryptedSharedPreferences (Keystore) — hardware validation **NOT_TESTED** in CI

## Modules

```
apps/android/
  app/                 # MainActivity, NavHost, FGS skeleton
  core/model/
  core/data/           # Room outbox + secure prefs
  core/permissions/    # BlePermissionMatrix + Compose permission UI
  core/ble/            # BleMeshRadio interface + skeleton
```

## Build & verify

```bash
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
cd apps/android
./gradlew assembleProdDebug testProdDebugUnitTest lintProdDebug ktlintCheck
./gradlew releaseProdArtifacts   # prod release APK + AAB (debug signing if no env keystore)
```

Release kapısı: [docs/release/android.md](../../docs/release/android.md) (ADIM 51).

## Permissions

See [docs/android/permission-guide.md](../../docs/android/permission-guide.md).

## SDK

- minSdk **26**, targetSdk **35** (ADR-010)

---

**Real device / instrumentation:** NOT_TESTED in GitHub-hosted CI (by design for ADIM 12).
