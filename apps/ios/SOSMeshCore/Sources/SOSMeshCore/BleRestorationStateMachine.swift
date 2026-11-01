import Foundation

/// Logical Core Bluetooth lifecycle for tests and UI copy (not an OS guarantee).
public enum BleRestorationPhase: String, Codable, Sendable, CaseIterable {
    case coldStart
    case awaitingPowerOn
    case readyForeground
    case scanning
    case connected
    case backgroundSuspended
    case restoringFromSystem
    case forceQuitTerminal
}

public enum BleRestorationEvent: String, Sendable {
    case appLaunched
    case bluetoothPoweredOn
    case beginScan
    case peerConnected
    case didEnterBackground
    case willEnterForeground
    case systemWillRestoreState
    case restorationCompleted
    case userForceQuit
    case bluetoothPoweredOff
}

public enum BleRestorationError: Error, Equatable {
    case invalidTransition(from: BleRestorationPhase, event: BleRestorationEvent)
}

/// State chart for ADIM 33 — documents Apple limits; force-quit is terminal (no relay promise).
public struct BleRestorationStateMachine: Sendable {
    private(set) public var phase: BleRestorationPhase

    public init(phase: BleRestorationPhase = .coldStart) {
        self.phase = phase
    }

    @discardableResult
    public mutating func apply(_ event: BleRestorationEvent) throws -> BleRestorationPhase {
        let next = try Self.nextPhase(from: phase, event: event)
        phase = next
        return next
    }

    public var canResumeBleWork: Bool {
        switch phase {
        case .readyForeground, .scanning, .connected, .restoringFromSystem:
            return true
        case .coldStart, .awaitingPowerOn, .backgroundSuspended, .forceQuitTerminal:
            return false
        }
    }

    public var userFacingLimitationKey: String? {
        switch phase {
        case .forceQuitTerminal:
            return "ios.limitation.force_quit"
        case .backgroundSuspended:
            return "ios.limitation.background"
        default:
            return nil
        }
    }

    private static func nextPhase(
        from: BleRestorationPhase,
        event: BleRestorationEvent
    ) throws -> BleRestorationPhase {
        switch (from, event) {
        case (.coldStart, .appLaunched):
            return .awaitingPowerOn
        case (.awaitingPowerOn, .bluetoothPoweredOn):
            return .readyForeground
        case (.readyForeground, .beginScan):
            return .scanning
        case (.scanning, .peerConnected):
            return .connected
        case (.connected, .didEnterBackground):
            return .backgroundSuspended
        case (.backgroundSuspended, .willEnterForeground):
            return .readyForeground
        case (.backgroundSuspended, .systemWillRestoreState):
            return .restoringFromSystem
        case (.restoringFromSystem, .restorationCompleted):
            return .readyForeground
        case (_, .userForceQuit):
            return .forceQuitTerminal
        case (.forceQuitTerminal, _):
            return .forceQuitTerminal
        case (.awaitingPowerOn, .bluetoothPoweredOff):
            return .awaitingPowerOn
        case (.readyForeground, .bluetoothPoweredOff):
            return .awaitingPowerOn
        case (.scanning, .bluetoothPoweredOff):
            return .awaitingPowerOn
        case (.connected, .bluetoothPoweredOff):
            return .awaitingPowerOn
        default:
            throw BleRestorationError.invalidTransition(from: from, event: event)
        }
    }
}
