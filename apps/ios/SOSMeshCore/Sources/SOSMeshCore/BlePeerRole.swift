import Foundation

public enum BlePeerRole: String, Codable, CaseIterable, Sendable {
    case sender = "SENDER"
    case relay = "RELAY"
    case both = "BOTH"
}

public enum BleRoleSelectionReason: String, Equatable, Sendable {
    case userPrefersRelay
    case userPrefersSender
    case sosPendingRequiresSender
    case relayEnabledRequiresPeripheral
}

public struct BleRoleSelector: Sendable {
    public init() {}

    /// Picks BLE responsibilities without exposing SOS plaintext to relay-only mode.
    public func resolve(
        preferredRole: BlePeerRole,
        relayToggleOn: Bool,
        hasPendingLocalSos: Bool
    ) -> (role: BlePeerRole, scan: Bool, advertise: Bool, reason: BleRoleSelectionReason) {
        if hasPendingLocalSos {
            return (.sender, true, false, .sosPendingRequiresSender)
        }
        if relayToggleOn {
            let role: BlePeerRole = preferredRole == .sender ? .both : .relay
            return (role, true, true, .relayEnabledRequiresPeripheral)
        }
        switch preferredRole {
        case .sender:
            return (.sender, true, false, .userPrefersSender)
        case .relay:
            return (.relay, true, true, .userPrefersRelay)
        case .both:
            return (.both, true, true, .userPrefersRelay)
        }
    }
}
