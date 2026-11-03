# SOSMesh Android App

**Status:** ADIM 12+ — Compose shell, **startup permission gate**, Room outbox, BLE SOS peer delivery wiring (JVM-tested), CI unit/lint

## Tech stack

- Kotlin, Jetpack Compose, Navigation, **Hilt** (ADR-010)
- Room outbox (`OutboxQueueAdapter`), `SosPeerDeliveryOrchestrator` → `BleTransferEngine`
- Startup **permission gate** (`PermissionGateRoute`) blocks home until runtime BLE/notification permissions + Bluetooth (and legacy location services when required)
- `packages/contracts-kotlin` as Gradle project dependency
- EncryptedSharedPreferences (Keystore) — hardware validation **NOT_TESTED** in CI

## Modules

```
apps/android/
  app/                 # MainActivity, permission gate, NavHost, FGS skeleton
  core/model/
  core/data/           # Room outbox + SosOutboxReader
  core/permissions/    # BlePermissionMatrix, permission gate UI
  core/ble/            # BleMeshRadio + GATT
  core/protocol/       # BleTransferEngine, SosPeerDeliveryOrchestrator
  feature-sos/         # SOS compose → outbox → peer delivery kickoff
  feature-relay/       # Relay receive + mesh-v2 forward orchestrator
  mesh-v2/
```

## Build & verify

```bash
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
cd apps/android
./gradlew assembleProdDebug testDebugUnitTest lint
./gradlew releaseProdArtifacts   # prod release APK + AAB (debug signing if no env keystore)
```

Release kapısı: [docs/release/android.md](../../docs/release/android.md) (ADIM 51).

## Permissions

See [docs/android/permission-guide.md](../../docs/android/permission-guide.md). Launch gate explains each runtime permission; home is unreachable until the gate clears.

## Physical BLE

End-to-end BLE SOS transfer on two or three devices is **NOT_TESTED** in GitHub CI. Manual checklist: [docs/tests/android-device-ble-checklist.md](../../docs/tests/android-device-ble-checklist.md). JVM coverage: `BleTransferSimulatedTest`, `SosPeerDeliveryOrchestratorTest`, `PeerDeliveryReceiveOrchestrationTest`.

## SDK

- minSdk **26**, targetSdk **35** (ADR-010)

---

**Real device / instrumentation:** BLE mesh on hardware **NOT_TESTED** in GitHub-hosted CI (by design).
