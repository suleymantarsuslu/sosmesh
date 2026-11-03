import Foundation

public enum PermissionGateBluetoothAuthorization: Equatable {
    case notDetermined
    case allowed
    case denied
    case restricted
    case unsupported
}

public enum PermissionGateNotificationAuthorization: Equatable {
    case notDetermined
    case authorized
    case denied
    case provisional
    case ephemeral
}

public struct PermissionGateSnapshot: Equatable {
    public var bluetoothAuthorization: PermissionGateBluetoothAuthorization
    public var bluetoothPoweredOn: Bool
    public var notificationAuthorization: PermissionGateNotificationAuthorization

    public init(
        bluetoothAuthorization: PermissionGateBluetoothAuthorization,
        bluetoothPoweredOn: Bool,
        notificationAuthorization: PermissionGateNotificationAuthorization
    ) {
        self.bluetoothAuthorization = bluetoothAuthorization
        self.bluetoothPoweredOn = bluetoothPoweredOn
        self.notificationAuthorization = notificationAuthorization
    }
}

public enum PermissionGateStep: String, CaseIterable, Equatable {
    case bluetooth
    case notifications
}

public enum PermissionGateBlockReason: Equatable {
    case notDetermined
    case denied
    case restricted
    case unsupported
    case bluetoothPoweredOff
}

public enum PermissionGateStatus: Equatable {
    case cleared
    case blocked(step: PermissionGateStep, reason: PermissionGateBlockReason)
}

public enum PermissionGateEvaluator {
    public static func evaluate(_ snapshot: PermissionGateSnapshot) -> PermissionGateStatus {
        switch snapshot.bluetoothAuthorization {
        case .notDetermined:
            return .blocked(step: .bluetooth, reason: .notDetermined)
        case .denied:
            return .blocked(step: .bluetooth, reason: .denied)
        case .restricted:
            return .blocked(step: .bluetooth, reason: .restricted)
        case .unsupported:
            return .blocked(step: .bluetooth, reason: .unsupported)
        case .allowed:
            if !snapshot.bluetoothPoweredOn {
                return .blocked(step: .bluetooth, reason: .bluetoothPoweredOff)
            }
        }

        switch snapshot.notificationAuthorization {
        case .notDetermined:
            return .blocked(step: .notifications, reason: .notDetermined)
        case .denied:
            return .blocked(step: .notifications, reason: .denied)
        case .authorized, .provisional, .ephemeral:
            break
        }

        return .cleared
    }

    public static func isCleared(_ status: PermissionGateStatus) -> Bool {
        if case .cleared = status { return true }
        return false
    }

    public static func needsOpenSettings(_ status: PermissionGateStatus) -> Bool {
        guard case .blocked(_, let reason) = status else { return false }
        switch reason {
        case .denied, .restricted:
            return true
        case .notDetermined, .unsupported, .bluetoothPoweredOff:
            return false
        }
    }
}
