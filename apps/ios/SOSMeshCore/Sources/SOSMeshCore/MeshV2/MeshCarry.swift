import Foundation
import SOSMeshContracts

public enum MeshV2DropReason: String, Equatable {
    case invalidEnvelope = "INVALID_ENVELOPE"
    case timeExpired = "TIME_EXPIRED"
    case maxHops = "MAX_HOPS"
    case ttlExceeded = "TTL_EXCEEDED"
    case copyCap = "COPY_CAP"
    case loopDetected = "LOOP_DETECTED"
}

/// Classified BLE transfer payload (§2.4).
public enum MeshTransferPayload: Equatable {
    case envelope(MeshRelayEnvelopeV2, l2: Data)
    case tombstones([DeliveryTombstone])
    case bareV1(messageId: String, l2: Data)
    case unknown
}

public struct TombstoneBatchV2: Codable, Equatable {
    public var kind = "TOMBSTONES"
    public var v = 2
    public var items: [DeliveryTombstone]

    public init(items: [DeliveryTombstone]) {
        self.items = items
    }
}

/// L1 envelope helpers. Relays only read the outer JSON; the L2 bytes are carried verbatim.
public enum MeshCarry {
    public static let maxL2Bytes = 16_384
    private static let deviceHashPattern = try! NSRegularExpression(pattern: "^[a-f0-9]{64}$")

    public static func classify(_ data: Data) -> MeshTransferPayload {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return .unknown }
        if (object["protocolVersion"] as? Int) == 2, object["messageId"] is String {
            guard let env = try? JSONDecoder().decode(MeshRelayEnvelopeV2.self, from: data),
                  let l2 = Data(base64Encoded: env.opaqueCiphertextBase64),
                  messageId(ofL2: l2) == env.messageId else { return .unknown }
            return .envelope(env, l2: l2)
        }
        if (object["kind"] as? String) == "TOMBSTONES" {
            guard let batch = try? JSONDecoder().decode(TombstoneBatchV2.self, from: data),
                  batch.v == 2, (1 ... MeshV2.maxTombstoneBatch).contains(batch.items.count) else { return .unknown }
            return .tombstones(batch.items)
        }
        if (object["version"] as? Int) == 1, let id = object["id"] as? String {
            return .bareV1(messageId: id, l2: data)
        }
        return .unknown
    }

    public static func messageId(ofL2 l2: Data) -> String? {
        (try? JSONSerialization.jsonObject(with: l2) as? [String: Any])?["id"] as? String
    }

    /// L2 `envelope.timestamp` and `envelope.priority` (public fields only).
    public static func publicMeta(ofL2 l2: Data) -> (createdAt: String?, priority: Int) {
        let object = (try? JSONSerialization.jsonObject(with: l2) as? [String: Any]) ?? [:]
        let envelope = object["envelope"] as? [String: Any] ?? [:]
        return (envelope["timestamp"] as? String, envelope["priority"] as? Int ?? 3)
    }

    /// Origin wrap: hopCount 0 (also used for bare v1 messages received from v1 peers).
    public static func wrap(l2: Data, messageId: String, originCreatedAt: String? = nil, nowMs: Int64) -> MeshRelayEnvelopeV2 {
        MeshRelayEnvelopeV2(
            protocolVersion: 2,
            messageId: messageId,
            hopCount: 0,
            maxHops: MeshV2.maxHops,
            ttlHops: MeshV2.ttlHops,
            copyCount: 1,
            maxCopyCount: MeshV2.maxCopyCount,
            originCreatedAt: originCreatedAt ?? publicMeta(ofL2: l2).createdAt ?? MeshV2.iso8601(ms: nowMs),
            opaqueCiphertextBase64: l2.base64EncodedString(),
            hopChainReceipt: HopChainReceiptV2(relayDeviceIdHashes: []),
            peerAckHint: "PEER_RECEIVED_ONLY"
        )
    }

    public static func encode(_ env: MeshRelayEnvelopeV2) -> Data? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try? encoder.encode(env)
    }

    public static func isExpired(_ env: MeshRelayEnvelopeV2, nowMs: Int64) -> Bool {
        guard let created = MeshV2.parseISO8601Ms(env.originCreatedAt) else { return true }
        return nowMs > created + MeshV2.timeTtlMs
    }

    /// Checks a received envelope before it is stored.
    public static func acceptIncoming(_ env: MeshRelayEnvelopeV2, selfDeviceHash: String, nowMs: Int64) -> MeshV2DropReason? {
        if !isValid(env) { return .invalidEnvelope }
        if isExpired(env, nowMs: nowMs) { return .timeExpired }
        if env.hopChainReceipt.relayDeviceIdHashes.contains(selfDeviceHash) { return .loopDetected }
        return nil
    }

    /// Next-hop envelope (same rules as the shared relay engines, plus the 24 h time TTL).
    public static func nextHop(_ env: MeshRelayEnvelopeV2, selfDeviceHash: String, nowMs: Int64) -> Result<MeshRelayEnvelopeV2, MeshV2DropReason> {
        if !isValid(env) || !matches(selfDeviceHash) { return .failure(.invalidEnvelope) }
        if isExpired(env, nowMs: nowMs) { return .failure(.timeExpired) }
        if env.hopChainReceipt.relayDeviceIdHashes.contains(selfDeviceHash) { return .failure(.loopDetected) }
        if env.hopCount >= env.maxHops { return .failure(.maxHops) }
        if env.copyCount >= env.maxCopyCount { return .failure(.copyCap) }
        let ttl = env.ttlHops - 1
        if ttl < 0 { return .failure(.ttlExceeded) }
        var next = env
        next.hopCount += 1
        next.ttlHops = ttl
        next.copyCount += 1
        next.hopChainReceipt = HopChainReceiptV2(relayDeviceIdHashes: env.hopChainReceipt.relayDeviceIdHashes + [selfDeviceHash])
        next.peerAckHint = "PEER_RECEIVED_ONLY"
        return .success(next)
    }

    /// Stored relay blob: an L1 envelope (v2) or a legacy bare L2 message (v1 / older builds).
    public static func decodeStored(_ blob: Data, nowMs: Int64) -> (envelope: MeshRelayEnvelopeV2, l2: Data)? {
        switch classify(blob) {
        case .envelope(let env, let l2):
            return (env, l2)
        case .bareV1(let id, let l2):
            return (wrap(l2: l2, messageId: id, nowMs: nowMs), l2)
        default:
            return nil
        }
    }

    private static func isValid(_ env: MeshRelayEnvelopeV2) -> Bool {
        env.protocolVersion == 2
            && (8 ... 128).contains(env.messageId.count)
            && env.hopCount >= 0 && env.hopCount <= env.maxHops && env.maxHops <= 32
            && env.ttlHops >= 0 && env.ttlHops <= 32
            && env.copyCount >= 1 && env.copyCount <= env.maxCopyCount && env.maxCopyCount <= 16
            && env.opaqueCiphertextBase64.count >= 4 && env.opaqueCiphertextBase64.count <= 21_848
            && env.hopChainReceipt.relayDeviceIdHashes.count <= 32
            && env.hopChainReceipt.relayDeviceIdHashes.allSatisfy(matches)
    }

    private static func matches(_ value: String) -> Bool {
        deviceHashPattern.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) != nil
    }
}

/// Gateway upload order (§9): own pending SOS first (oldest first), then carried copies by
/// public priority ascending, then origin time ascending.
public enum MeshUploadOrdering {
    public static func ordered(_ entries: [OutboxEntryMeta]) -> [OutboxEntryMeta] {
        let own = entries.filter { $0.origin != SosOutboxService.relayOrigin }.sorted { $0.createdAtMs < $1.createdAtMs }
        let carried = entries.filter { $0.origin == SosOutboxService.relayOrigin }.map { entry -> (OutboxEntryMeta, Int, Int64) in
            guard let blob = Data(base64Encoded: entry.encryptedBlobBase64),
                  let decoded = MeshCarry.decodeStored(blob, nowMs: entry.createdAtMs) else { return (entry, 5, entry.createdAtMs) }
            let priority = MeshCarry.publicMeta(ofL2: decoded.l2).priority
            let origin = MeshV2.parseISO8601Ms(decoded.envelope.originCreatedAt) ?? entry.createdAtMs
            return (entry, priority, origin)
        }.sorted { ($0.1, $0.2, $0.0.createdAtMs) < ($1.1, $1.2, $1.0.createdAtMs) }.map(\.0)
        return own + carried
    }
}

/// Client SOS rate limit (§8.1): 1 per 60 s, 10 per hour. Never refuses an SOS.
public enum SosRateLimiter {
    public static let minIntervalMs: Int64 = 60_000
    public static let windowMs: Int64 = 3_600_000
    public static let maxPerWindow = 10

    public enum Plan: Equatable {
        case sendNow
        /// The previous own SOS never left the device: replace it with the new one.
        case replace(sosId: String, digest: String)
        /// Keep the new SOS and release it at this time.
        case queueUntil(Int64)
    }

    public static func plan(ownEntries: [OutboxEntryMeta], nowMs: Int64) -> Plan {
        let recent = ownEntries
            .filter { $0.origin != SosOutboxService.relayOrigin && nowMs - $0.createdAtMs < windowMs }
            .sorted { $0.createdAtMs < $1.createdAtMs }
        guard let last = recent.last else { return .sendNow }
        // LOCAL_SAVED = no peer ACK and no server receipt yet (a queued SOS also counts).
        let lastLeftDevice = last.state != "LOCAL_SAVED"
        let tooSoon = nowMs - last.createdAtMs < minIntervalMs
        let tooMany = recent.count >= maxPerWindow
        guard tooSoon || tooMany else { return .sendNow }
        if !lastLeftDevice {
            return .replace(sosId: last.sosId, digest: last.digest)
        }
        var release = nowMs
        if tooSoon { release = max(release, last.createdAtMs + minIntervalMs) }
        if tooMany { release = max(release, recent[recent.count - maxPerWindow].createdAtMs + windowMs) }
        return .queueUntil(release)
    }
}
