import Foundation

/// Experimental multi-hop relay (ADIM 41). Default off — not a 24/7 repeater product claim.
public enum MeshRelayFeatureFlags {
    private static let experimentalKey = "sosmesh.experimental.multihop.enabled"

    /// User-facing opt-in for foreground multi-hop research path. Guard skips are never exposed.
    public static var isExperimentalMultihopRelayEnabled: Bool {
        UserDefaults.standard.bool(forKey: experimentalKey)
    }

    public static func setExperimentalMultihopRelayEnabled(_ enabled: Bool) {
        UserDefaults.standard.set(enabled, forKey: experimentalKey)
    }
}

/// Foreground-only multi-hop evaluation; returns nil when feature flag is off.
public struct MeshMultihopRelayCoordinator {
    private let engine: MeshRelayEngine

    public init(lruCapacity: Int = 256) {
        engine = MeshRelayEngineFactory.createRelayEngine(lruCapacity: lruCapacity)
    }

    public func evaluateForwardIfEnabled(
        envelope: MeshRelayEnvelopeV2,
        relayDeviceIdHash: String
    ) -> MeshRelayEngineOutcome? {
        guard MeshRelayFeatureFlags.isExperimentalMultihopRelayEnabled else {
            return nil
        }
        return engine.evaluateForward(envelope: envelope, relayDeviceIdHash: relayDeviceIdHash)
    }
}
