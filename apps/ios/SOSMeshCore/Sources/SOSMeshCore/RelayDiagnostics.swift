import Foundation
import SOSMeshContracts

/// Privacy-safe BLE relay diagnostics: counters, flags and short hashes only.
/// Never stores payloads, note text, coordinates or full message ids.
public struct RelayDiagnosticsSnapshot: Equatable {
    public var bluetooth: BleAuthorizationSnapshot = .unknown
    public var scanning = false
    public var advertising = false
    public var peersSeen = 0
    public var connectedPeers = 0
    public var lastSentAtMs: Int64?
    public var lastReceivedAtMs: Int64?
    /// First 8 hex chars of SHA-256(message id) of the last received envelope.
    public var lastReceivedShortHash: String?
    public var pendingForward = 0
    public var forwardedCount = 0
    public var lastErrorCode: String?

    public init() {}
}

public final class RelayDiagnostics: @unchecked Sendable {
    private var value = RelayDiagnosticsSnapshot()
    private let lock = NSLock()

    public init() {}

    public func snapshot() -> RelayDiagnosticsSnapshot {
        lock.lock()
        defer { lock.unlock() }
        return value
    }

    public func update(_ change: (inout RelayDiagnosticsSnapshot) -> Void) {
        lock.lock()
        defer { lock.unlock() }
        change(&value)
    }

    public func recordSent(nowMs: Int64) {
        update { $0.lastSentAtMs = nowMs }
    }

    public func recordReceived(sosId: String, nowMs: Int64) {
        let hash = RelayDiagnostics.shortHash(sosId)
        update {
            $0.lastReceivedAtMs = nowMs
            $0.lastReceivedShortHash = hash
        }
    }

    public func recordForwarded() {
        update { $0.forwardedCount += 1 }
    }

    public func recordError(code: String) {
        update { $0.lastErrorCode = code }
    }

    public static func shortHash(_ text: String) -> String {
        let digest = BleProtocol.calculateSHA256(Data(text.utf8))
        return digest.prefix(4).map { String(format: "%02x", $0) }.joined()
    }
}
