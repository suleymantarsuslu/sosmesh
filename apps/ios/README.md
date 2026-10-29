# SOSMesh iOS/watchOS App

**Status:** Skeleton - Implementation pending

## Overview

Native iOS and watchOS application for SOSMesh emergency mesh network.

**Tech Stack:**
- Swift
- SwiftUI (UI)
- Core Data / SwiftData (local database)
- Core Bluetooth (BLE)
- Async/Await concurrency

**Target:**
- iOS 17.0+
- watchOS 10.0+

## Setup

1. Install CocoaPods: `sudo gem install cocoapods`
2. Install dependencies: `pod install`
3. Open `SOSMesh.xcworkspace` in Xcode
4. Build and run

## Build

- Xcode: Cmd+B
- Command line: `xcodebuild -workspace SOSMesh.xcworkspace -scheme SOSMesh-iOS build`

## Lint

```bash
swiftlint lint --strict
```

## Architecture

_(To be documented in implementation phase)_

---

**Implementation:** ADIM 06 (Native Mobile)
