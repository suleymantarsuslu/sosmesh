# SOSMesh iOS / watchOS

**Status:** ADIM 31–33 iskelet; ADIM 34 çapraz UX; ADIM 41 multi-hop; **ADIM 52** release/TestFlight hazırlığı (fiziksel **NOT_TESTED**, TestFlight **BLOCKED_APPROVAL**)

## Overview

Native iOS client for the SOSMesh emergency mesh network.

**Tech stack:** Swift, SwiftUI, Core Bluetooth, local package `SOSMeshCore`, shared `packages/contracts-swift`.

**Target:** iOS 17.0+, watchOS 10.0+ (SOSMesh-Watch)

## Multi-hop research (ADIM 41)

- Motor: `SOSMeshCore/MeshRelayEngine.swift` — `packages/contracts/protocol-v2/vectors/relay-engine-cases.json` ile TS/Kotlin parity.
- **Feature flag kapalı varsayılan:** Ayarlar → deneysel çok atlama. Guard skip public API'de yok.
- iPhone **7/24 tekrarlayıcı değildir**; arka plan / force-quit: `docs/research/ios-multihop.md`, `docs/compat/ios-background-matrix.csv`.

## Cross-platform (ADIM 34)

- Hata UX: `Features/CrossPlatformFaultViews.swift`
- Rapor: `docs/tests/cross-platform-integration-report.md`
- Uyumluluk: `docs/compat/cross-platform-matrix.csv` (fiziksel satırlar NOT_TESTED)

## Setup

See [docs/ios/setup.md](../../docs/ios/setup.md).

```bash
cd apps/ios
pod install
open SOSMesh.xcworkspace
```

## Linux core tests

```bash
export SOURCE_ROOT="$(git rev-parse --show-toplevel)"
cd apps/ios/SOSMeshCore && swift test
```

## Lint

```bash
swiftlint lint --strict
```

## Architecture

- `SOSMesh/` — SwiftUI shell (SOS, Status, Relay, Settings)
- `SOSMeshCore/` — Testable core (outbox, envelope, BLE role/restoration state machines)
- `CoreBLE/` — CBCentralManager / CBPeripheralManager adapters

Physical BLE and background behavior: **NOT_TESTED** on this repo snapshot; see `docs/compat/ios-background-matrix.csv`.

Release archive, privacy manifests, TestFlight gate: **`docs/release/ios.md`** (ADIM 52).
