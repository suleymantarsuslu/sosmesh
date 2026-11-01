# SOSMesh iOS / watchOS

**Status:** ADIM 31–33 — SwiftUI iskelet, CoreBLE, SOSMeshCore paketi

## Overview

Native iOS client for the SOSMesh emergency mesh network.

**Tech stack:** Swift, SwiftUI, Core Bluetooth, local package `SOSMeshCore`, shared `packages/contracts-swift`.

**Target:** iOS 17.0+, watchOS 10.0+ (SOSMesh-Watch)

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
