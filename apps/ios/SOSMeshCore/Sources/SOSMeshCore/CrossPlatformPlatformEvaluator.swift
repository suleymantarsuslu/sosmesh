import Foundation

public enum CrossPlatformUserHint: String, CaseIterable, Equatable {
    case none
    case fixBluetooth
    case fixPermissions
    case locationUnavailable
    case transferCorrupt
    case apiUploadFailed
    case networkOfflineRelay
    case lowBatteryRelayPaused
}

public struct CrossPlatformPlatformState: Equatable {
    public var bluetoothEnabled: Bool
    public var blePermissionsGranted: Bool
    public var locationAvailable: Bool
    public var networkValidated: Bool
    public var batteryLevelPercent: Int
    public var relayOptIn: Bool
    public var lastTransferCorrupt: Bool
    public var lastApiUploadFailed: Bool

    public init(
        bluetoothEnabled: Bool = true,
        blePermissionsGranted: Bool = true,
        locationAvailable: Bool = true,
        networkValidated: Bool = false,
        batteryLevelPercent: Int = 100,
        relayOptIn: Bool = false,
        lastTransferCorrupt: Bool = false,
        lastApiUploadFailed: Bool = false
    ) {
        self.bluetoothEnabled = bluetoothEnabled
        self.blePermissionsGranted = blePermissionsGranted
        self.locationAvailable = locationAvailable
        self.networkValidated = networkValidated
        self.batteryLevelPercent = batteryLevelPercent
        self.relayOptIn = relayOptIn
        self.lastTransferCorrupt = lastTransferCorrupt
        self.lastApiUploadFailed = lastApiUploadFailed
    }
}

public enum CrossPlatformPlatformEvaluator {
    private static let batteryLowThreshold = 15

    public static func userHint(for state: CrossPlatformPlatformState) -> CrossPlatformUserHint {
        if state.lastTransferCorrupt {
            return .transferCorrupt
        }
        if state.lastApiUploadFailed {
            return .apiUploadFailed
        }
        if !state.bluetoothEnabled {
            return .fixBluetooth
        }
        if !state.blePermissionsGranted {
            return .fixPermissions
        }
        if !state.locationAvailable {
            return .locationUnavailable
        }
        if state.relayOptIn, state.batteryLevelPercent < batteryLowThreshold {
            return .lowBatteryRelayPaused
        }
        if state.relayOptIn, !state.networkValidated {
            return .networkOfflineRelay
        }
        return .none
    }
}
