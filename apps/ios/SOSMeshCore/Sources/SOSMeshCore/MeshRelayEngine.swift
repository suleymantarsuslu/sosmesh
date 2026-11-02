import Foundation

public struct HopChainReceiptV2: Codable, Equatable {
    public var relayDeviceIdHashes: [String]

    public init(relayDeviceIdHashes: [String] = []) {
        self.relayDeviceIdHashes = relayDeviceIdHashes
    }
}

public struct MeshRelayEnvelopeV2: Codable, Equatable {
    public var protocolVersion: Int
    public var messageId: String
    public var hopCount: Int
    public var maxHops: Int
    public var ttlHops: Int
    public var copyCount: Int
    public var maxCopyCount: Int
    public var originCreatedAt: String
    public var opaqueCiphertextBase64: String
    public var hopChainReceipt: HopChainReceiptV2
    public var peerAckHint: String?

    public init(
        protocolVersion: Int,
        messageId: String,
        hopCount: Int,
        maxHops: Int,
        ttlHops: Int,
        copyCount: Int,
        maxCopyCount: Int,
        originCreatedAt: String,
        opaqueCiphertextBase64: String,
        hopChainReceipt: HopChainReceiptV2,
        peerAckHint: String? = nil
    ) {
        self.protocolVersion = protocolVersion
        self.messageId = messageId
        self.hopCount = hopCount
        self.maxHops = maxHops
        self.ttlHops = ttlHops
        self.copyCount = copyCount
        self.maxCopyCount = maxCopyCount
        self.originCreatedAt = originCreatedAt
        self.opaqueCiphertextBase64 = opaqueCiphertextBase64
        self.hopChainReceipt = hopChainReceipt
        self.peerAckHint = peerAckHint
    }
}

public enum MeshRelayDropReason: String, Equatable {
    case ttlExceeded = "TTL_EXCEEDED"
    case maxHops = "MAX_HOPS"
    case duplicate = "DUPLICATE"
    case copyCap = "COPY_CAP"
    case loopDetected = "LOOP_DETECTED"
    case invalidEnvelope = "INVALID_ENVELOPE"
}

public enum MeshRelayDecision: String, Equatable {
    case forward = "FORWARD"
    case drop = "DROP"
}

public struct MeshRelayEngineOutcome: Equatable {
    public var decision: MeshRelayDecision
    public var dropReason: MeshRelayDropReason?
    public var forward: MeshRelayEnvelopeV2?
    public var dedupKey: String?

    public init(
        decision: MeshRelayDecision,
        dropReason: MeshRelayDropReason? = nil,
        forward: MeshRelayEnvelopeV2? = nil,
        dedupKey: String? = nil
    ) {
        self.decision = decision
        self.dropReason = dropReason
        self.forward = forward
        self.dedupKey = dedupKey
    }
}

public struct MeshRelayEngineConfig {
    public var lruCapacity: Int

    public init(lruCapacity: Int) {
        self.lruCapacity = lruCapacity
    }
}

struct MeshRelayEngineRuntimeConfig {
    var lruCapacity: Int
    var skipTtlDecrement: Bool = false
    var skipDedupCheck: Bool = false
    var skipLoopGuard: Bool = false
    var skipMaxHopsCheck: Bool = false

    static func fromPublic(_ config: MeshRelayEngineConfig) -> MeshRelayEngineRuntimeConfig {
        MeshRelayEngineRuntimeConfig(lruCapacity: config.lruCapacity)
    }
}

private let deviceHashPattern = try! NSRegularExpression(pattern: "^[a-f0-9]{64}$")

public func buildDedupKey(envelope: MeshRelayEnvelopeV2) -> String {
    let prefix = String(envelope.opaqueCiphertextBase64.prefix(8))
    return "\(envelope.messageId):\(envelope.hopCount):\(prefix)"
}

public func relayLogSnapshot(envelope: MeshRelayEnvelopeV2) -> String {
    let prefix = String(envelope.opaqueCiphertextBase64.prefix(24))
    return """
    {"messageId":"\(envelope.messageId)","hopCount":\(envelope.hopCount),"ttlHops":\(envelope.ttlHops),"ciphertextPrefix":"\(prefix)"}
    """
}

public final class MeshRelayDedupStore {
    private let capacity: Int
    private var order: [String] = []
    private var seen = Set<String>()

    public init(capacity: Int) {
        self.capacity = capacity
    }

    public func has(_ key: String) -> Bool {
        seen.contains(key)
    }

    public func remember(_ key: String) {
        if seen.contains(key) { return }
        seen.insert(key)
        order.append(key)
        while order.count > capacity {
            let evicted = order.removeFirst()
            seen.remove(evicted)
        }
    }
}

public final class MeshRelayEngine {
    private let config: MeshRelayEngineRuntimeConfig
    private let dedup: MeshRelayDedupStore

    public init(publicConfig: MeshRelayEngineConfig) {
        self.config = MeshRelayEngineRuntimeConfig.fromPublic(publicConfig)
        self.dedup = MeshRelayDedupStore(capacity: publicConfig.lruCapacity)
    }

    init(runtime: MeshRelayEngineRuntimeConfig) {
        self.config = runtime
        self.dedup = MeshRelayDedupStore(capacity: runtime.lruCapacity)
    }

    public func seedDedupKey(_ key: String) {
        dedup.remember(key)
    }

    public func evaluateForward(
        envelope: MeshRelayEnvelopeV2,
        relayDeviceIdHash: String
    ) -> MeshRelayEngineOutcome {
        if !validateEnvelope(envelope) {
            return MeshRelayEngineOutcome(decision: .drop, dropReason: .invalidEnvelope)
        }
        if !matchesDeviceHash(relayDeviceIdHash) {
            return MeshRelayEngineOutcome(decision: .drop, dropReason: .invalidEnvelope)
        }

        let dedupKey = buildDedupKey(envelope: envelope)
        if !config.skipDedupCheck, dedup.has(dedupKey) {
            return MeshRelayEngineOutcome(decision: .drop, dropReason: .duplicate, dedupKey: dedupKey)
        }

        if !config.skipLoopGuard,
           envelope.hopChainReceipt.relayDeviceIdHashes.contains(relayDeviceIdHash) {
            return MeshRelayEngineOutcome(decision: .drop, dropReason: .loopDetected, dedupKey: dedupKey)
        }

        if !config.skipMaxHopsCheck, envelope.hopCount >= envelope.maxHops {
            return MeshRelayEngineOutcome(decision: .drop, dropReason: .maxHops, dedupKey: dedupKey)
        }

        if envelope.copyCount >= envelope.maxCopyCount {
            return MeshRelayEngineOutcome(decision: .drop, dropReason: .copyCap, dedupKey: dedupKey)
        }

        var nextTtl = envelope.ttlHops - 1
        if config.skipTtlDecrement {
            nextTtl = envelope.ttlHops
        }
        if nextTtl < 0 {
            return MeshRelayEngineOutcome(decision: .drop, dropReason: .ttlExceeded, dedupKey: dedupKey)
        }

        dedup.remember(dedupKey)

        var forward = envelope
        forward.hopCount = envelope.hopCount + 1
        forward.ttlHops = nextTtl
        forward.copyCount = envelope.copyCount + 1
        forward.hopChainReceipt = HopChainReceiptV2(
            relayDeviceIdHashes: envelope.hopChainReceipt.relayDeviceIdHashes + [relayDeviceIdHash]
        )
        forward.peerAckHint = "PEER_RECEIVED_ONLY"

        return MeshRelayEngineOutcome(decision: .forward, forward: forward, dedupKey: dedupKey)
    }

    private func validateEnvelope(_ envelope: MeshRelayEnvelopeV2) -> Bool {
        if envelope.protocolVersion != 2 { return false }
        if envelope.hopCount < 0 || envelope.hopCount > envelope.maxHops { return false }
        if envelope.ttlHops < 0 { return false }
        if envelope.copyCount < 1 || envelope.copyCount > envelope.maxCopyCount { return false }
        for hash in envelope.hopChainReceipt.relayDeviceIdHashes {
            if !matchesDeviceHash(hash) { return false }
        }
        return envelope.opaqueCiphertextBase64.count >= 4
    }

    private func matchesDeviceHash(_ value: String) -> Bool {
        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        return deviceHashPattern.firstMatch(in: value, range: range) != nil
    }
}

public enum MeshRelayEngineFactory {
    public static func createRelayEngine(lruCapacity: Int) -> MeshRelayEngine {
        MeshRelayEngine(publicConfig: MeshRelayEngineConfig(lruCapacity: lruCapacity))
    }
}

#if DEBUG
enum MeshRelayEngineTesting {
    struct TestingConfig {
        var lruCapacity: Int
        var skipTtlDecrement: Bool = false
        var skipDedupCheck: Bool = false
        var skipLoopGuard: Bool = false
        var skipMaxHopsCheck: Bool = false
    }

    static func create(_ config: TestingConfig) -> MeshRelayEngine {
        MeshRelayEngine(
            runtime: MeshRelayEngineRuntimeConfig(
                lruCapacity: config.lruCapacity,
                skipTtlDecrement: config.skipTtlDecrement,
                skipDedupCheck: config.skipDedupCheck,
                skipLoopGuard: config.skipLoopGuard,
                skipMaxHopsCheck: config.skipMaxHopsCheck
            )
        )
    }
}
#endif
