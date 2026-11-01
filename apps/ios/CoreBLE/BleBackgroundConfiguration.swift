import Foundation
import SOSMeshCore

public enum BleBackgroundConfiguration {
    public static let requiredBackgroundModes = [
        "bluetooth-central",
        "bluetooth-peripheral",
    ]

    public static let limitationCopyKeys = [
        "ios.limitation.background",
        "ios.limitation.force_quit",
        "ios.limitation.relay_without_internet",
    ]

    public static func restorationOptions(for role: BlePeerRole) -> [String: String] {
        switch role {
        case .sender:
            return [BleMeshConstants.centralRestorationIdentifier: "central"]
        case .relay:
            return [BleMeshConstants.peripheralRestorationIdentifier: "peripheral"]
        case .both:
            return [
                BleMeshConstants.centralRestorationIdentifier: "central",
                BleMeshConstants.peripheralRestorationIdentifier: "peripheral",
            ]
        }
    }
}
