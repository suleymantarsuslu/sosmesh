import Foundation
import SOSMeshContracts

/// Mesh v2 node state: reachability, seen cache, tombstones and the carry store (outbox, origin
/// `relay`). Handles only public envelope fields; the encrypted payload is never opened here.
public final class MeshV2Node: @unchecked Sendable {
    public enum ReceiveOutcome: Equatable {
        case stored(messageKeyHex: String)
        case duplicate
        case delivered
        case dropped(MeshV2DropReason)
        case tombstones(applied: Int)
        case unknown
    }

    public struct Candidate: Equatable {
        public let messageId: String
        public let key: Data
        public let trackerSosId: String
        public let trackerDigest: String
        public let payload: Data
        public let isOwn: Bool
    }

    public struct Stats: Equatable {
        public var hops: UInt8
        public var peers: Int
        public var carried: Int
        public var tombstones: Int
    }

    public static let carryDigestPrefix = "carry:"
    public static let tombstoneBatchSosId = "mesh-v2-tombstones"

    public let hops: GatewayHopsTracker
    public let seen: MeshSeenCache
    public let tombstones: TombstoneStore
    public let broadcasts: BroadcastCarryStore
    public let deviceHash: String
    private let verifier: TombstoneVerifier
    private let outbox: SosOutboxService
    private let relayIdHex: String
    private let lock = NSLock()
    private var relayEnabledValue = true
    public var isWatch = false
    public var broadcastVerifier: ((ServerBroadcast) -> Bool)?
    public var broadcastNotifier: ((ServerBroadcast) -> Void)?
    public var locationProvider: (() -> (Double, Double)?)?
    public var relayDeliveryCounter: RelayDeliveryCounterPort?

    public init(outbox: SosOutboxService, relayIdHex: String, receiptKeySpkiBase64: String, directory: URL?, nowMs: Int64, relayDeliveryCounter: RelayDeliveryCounterPort? = nil) {
        self.outbox = outbox
        self.relayIdHex = relayIdHex
        self.relayDeliveryCounter = relayDeliveryCounter
        deviceHash = MeshV2.sha256Hex(Data(relayIdHex.utf8))
        verifier = TombstoneVerifier(publicKeySpkiBase64: receiptKeySpkiBase64)
        hops = GatewayHopsTracker(selfKey: MeshInfo.selfKey(relayIdHex: relayIdHex, nowMs: nowMs))
        seen = MeshSeenCache(fileURL: directory?.appendingPathComponent("mesh-v2-seen.json"))
        tombstones = TombstoneStore(fileURL: directory?.appendingPathComponent("mesh-v2-tombstones.json"))
        broadcasts = BroadcastCarryStore()
    }

    public var relayEnabled: Bool {
        get { lock.lock(); defer { lock.unlock() }; return relayEnabledValue }
        set { lock.lock(); relayEnabledValue = newValue; lock.unlock() }
    }

    // MARK: Status

    public func carried() -> [OutboxEntryMeta] {
        ((try? outbox.listEntries()) ?? []).filter { $0.origin == SosOutboxService.relayOrigin && $0.state == "LOCAL_SAVED" }
    }

    private func ownPending() -> [OutboxEntryMeta] {
        ((try? outbox.listEntries()) ?? []).filter { $0.origin != SosOutboxService.relayOrigin && $0.state == "LOCAL_SAVED" }
    }

    public func meshInfo(nowMs: Int64) -> MeshInfo {
        hops.updateSelfKey(MeshInfo.selfKey(relayIdHex: relayIdHex, nowMs: nowMs))
        let h = hops.compute(nowMs: nowMs)
        var flags: UInt8 = 0
        if relayEnabled { flags |= MeshInfo.flagRelay | MeshInfo.flagAcceptsCarry }
        if isWatch { flags |= MeshInfo.flagWatch }
        if !ownPending().isEmpty { flags |= MeshInfo.flagOwnPending }
        let fill = UInt8(min(100, carried().count * 100 / MeshV2.carryCapacity))
        return MeshInfo(hops: h, flags: flags, carryFillPercent: fill, secondsSinceConfirmed: hops.secondsSinceConfirmed(nowMs: nowMs), selfKey: hops.selfKey, parentKey: hops.parentKey())
    }

    public func stats(nowMs: Int64) -> Stats {
        Stats(hops: hops.compute(nowMs: nowMs), peers: hops.freshNeighbors(nowMs: nowMs).count, carried: carried().count, tombstones: tombstones.count)
    }
    
    public func onBroadcastFrame(_ broadcast: ServerBroadcast, nowMs: Int64) {
        if broadcasts.contains(broadcast.id) {
            return
        }
        
        guard let expiresAt = MeshV2.parseISO8601Ms(broadcast.expiresAt), expiresAt > nowMs else {
            return
        }
        
        if broadcast.hopsLeft <= 0 {
            return
        }
        
        guard let verifier = broadcastVerifier, verifier(broadcast) else {
            return
        }
        
        if let regionLat = broadcast.regionLat, let regionLng = broadcast.regionLng, let regionRadiusKm = broadcast.regionRadiusKm {
            if let location = locationProvider?() {
                let distanceKm = calculateDistance(lat1: location.0, lng1: location.1, lat2: regionLat, lng2: regionLng)
                if distanceKm > regionRadiusKm {
                    return
                }
            }
        }
        
        _ = broadcasts.put(broadcast, receivedAtMs: nowMs)
        broadcastNotifier?(broadcast)
    }
    
    private func calculateDistance(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
        let r = 6371.0
        let dLat = (lat2 - lat1) * .pi / 180.0
        let dLng = (lng2 - lng1) * .pi / 180.0
        let a = sin(dLat / 2) * sin(dLat / 2) +
                cos(lat1 * .pi / 180.0) * cos(lat2 * .pi / 180.0) *
                sin(dLng / 2) * sin(dLng / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }
    
    public func takeBroadcastFor(peerId: String, nowMs: Int64) -> ServerBroadcast? {
        broadcasts.takeForPeer(peerId, nowMs: nowMs)
    }

    // MARK: Peripheral side

    /// OFFER / TOMBSTONE_REQUEST written to FFF1 → frames to notify on FFF3.
    public func respond(toControl data: Data, nowMs: Int64) -> [Data] {
        switch MeshV2Frame.decode(data) {
        case .offer(let keys):
            let statuses = keys.map { offerStatus(for: $0, nowMs: nowMs) }
            return [MeshV2Frame.offerReply(statuses).encode()].compactMap { $0 }
        case .tombstoneRequest(let keys):
            return keys.compactMap { key in
                guard var t = tombstones.tombstone(forKey: key, nowMs: nowMs) else { return nil }
                t.hopsLeft = (t.hopsLeft ?? 1) > 0 ? (t.hopsLeft ?? 1) - 1 : 0
                return MeshV2Frame.tombstone(t).encode()
            }
        default:
            return []
        }
    }

    public func offerStatus(for key: Data, nowMs: Int64) -> MeshOfferStatus {
        if tombstones.tombstone(forKey: key, nowMs: nowMs) != nil { return .delivered }
        if seen.state(for: key, nowMs: nowMs) != nil { return .have }
        let entries = (try? outbox.listEntries()) ?? []
        if entries.contains(where: { MeshV2.messageKey($0.sosId) == key }) { return .have }
        if !relayEnabled { return .refused }
        let carriedEntries = entries.filter { $0.origin == SosOutboxService.relayOrigin && $0.state == "LOCAL_SAVED" }
        let bytes = carriedEntries.reduce(0) { $0 + $1.encryptedBlobBase64.count * 3 / 4 }
        // Count overflow is handled by evicting the oldest copy; only the byte budget refuses.
        if bytes >= MeshV2.carryCapacityBytes { return .full }
        return .want
    }

    /// Completed (VERIFIED) ble-v1 transfer payload.
    public func receive(payload: Data, nowMs: Int64) -> ReceiveOutcome {
        switch MeshCarry.classify(payload) {
        case .envelope(let env, let l2):
            return store(env, l2: l2, nowMs: nowMs)
        case .bareV1(let id, let l2):
            return store(MeshCarry.wrap(l2: l2, messageId: id, nowMs: nowMs), l2: l2, nowMs: nowMs)
        case .tombstones(let items):
            let applied = items.filter { ingestTombstone($0, nowMs: nowMs) }.count
            return .tombstones(applied: applied)
        case .unknown:
            return .unknown
        }
    }

    private func store(_ env: MeshRelayEnvelopeV2, l2: Data, nowMs: Int64) -> ReceiveOutcome {
        guard l2.count <= MeshCarry.maxL2Bytes else { return .dropped(.invalidEnvelope) }
        let key = MeshV2.messageKey(env.messageId)
        if tombstones.tombstone(forKey: key, nowMs: nowMs) != nil { return .delivered }
        if let reason = MeshCarry.acceptIncoming(env, selfDeviceHash: deviceHash, nowMs: nowMs) {
            seen.mark(key, state: .carrying, nowMs: nowMs)
            return .dropped(reason)
        }
        let entries = (try? outbox.listEntries()) ?? []
        if entries.contains(where: { $0.sosId == env.messageId }) {
            seen.mark(key, state: .carrying, nowMs: nowMs)
            return .duplicate
        }
        evictIfFull(entries: entries)
        guard let blob = MeshCarry.encode(env) else { return .dropped(.invalidEnvelope) }
        let digest = BleProtocol.calculateSHA256(l2).base64EncodedString()
        do {
            try outbox.enqueueRelayEnvelope(sosId: env.messageId, digest: digest, envelope: blob, nowMs: nowMs)
            relayDeliveryCounter?.recordCarriedMessage(messageId: env.messageId)
        } catch {
            return .unknown
        }
        seen.mark(key, state: .carrying, nowMs: nowMs)
        return .stored(messageKeyHex: MeshV2.hex(key))
    }

    private func evictIfFull(entries: [OutboxEntryMeta]) {
        let carriedEntries = entries.filter { $0.origin == SosOutboxService.relayOrigin }
        guard carriedEntries.count >= MeshV2.carryCapacity else { return }
        // Oldest origin time first; own SOS entries are never evicted.
        let ordered = carriedEntries.sorted { lhs, rhs in
            originMs(lhs) < originMs(rhs)
        }
        for entry in ordered.prefix(carriedEntries.count - MeshV2.carryCapacity + 1) {
            _ = try? outbox.removeEntry(sosId: entry.sosId, digest: entry.digest)
        }
    }

    private func originMs(_ entry: OutboxEntryMeta) -> Int64 {
        guard let blob = Data(base64Encoded: entry.encryptedBlobBase64),
              let decoded = MeshCarry.decodeStored(blob, nowMs: entry.createdAtMs) else { return entry.createdAtMs }
        return MeshV2.parseISO8601Ms(decoded.envelope.originCreatedAt) ?? entry.createdAtMs
    }

    /// Drops carried copies past the 24 h time TTL.
    public func purgeExpired(nowMs: Int64) {
        for entry in carried() {
            guard let blob = Data(base64Encoded: entry.encryptedBlobBase64),
                  let decoded = MeshCarry.decodeStored(blob, nowMs: entry.createdAtMs) else { continue }
            if MeshCarry.isExpired(decoded.envelope, nowMs: nowMs) {
                _ = try? outbox.removeEntry(sosId: entry.sosId, digest: entry.digest)
            }
        }
        seen.purge(nowMs: nowMs)
        tombstones.purge(nowMs: nowMs)
    }

    // MARK: Tombstones

    /// Verifies (bundled key, 72 h window), stores and applies a tombstone.
    @discardableResult
    public func ingestTombstone(_ t: DeliveryTombstone, nowMs: Int64) -> Bool {
        guard verifier.verify(t, nowMs: nowMs) else { return false }
        tombstones.add(t, nowMs: nowMs)
        applyVerified(t, nowMs: nowMs)
        return true
    }

    /// Receipt from our own `/v1/ingest` upload (already verified by the uploader).
    public func recordServerReceipt(_ receipt: ServerAcceptedReceipt, nowMs: Int64) {
        let t = DeliveryTombstone(receipt: receipt)
        tombstones.add(t, nowMs: nowMs)
        applyVerified(t, nowMs: nowMs)
    }

    /// Carried copies with the same packet hash are deleted; the origin's own entry moves to
    /// SERVER_ACCEPTED and keeps its history. A hash mismatch keeps the copy.
    public func applyVerified(_ t: DeliveryTombstone, nowMs: Int64) {
        let entries = ((try? outbox.listEntries()) ?? []).filter { $0.sosId == t.messageId }
        var carriedAndVerified = false
        for entry in entries {
            guard let blob = Data(base64Encoded: entry.encryptedBlobBase64) else { continue }
            if entry.origin == SosOutboxService.relayOrigin {
                guard let decoded = MeshCarry.decodeStored(blob, nowMs: nowMs),
                      MeshV2.sha256Hex(decoded.l2) == t.packetHash else { continue }
                carriedAndVerified = true
                _ = try? outbox.removeEntry(sosId: entry.sosId, digest: entry.digest)
            } else {
                guard MeshV2.sha256Hex(blob) == t.packetHash,
                      entry.state == "LOCAL_SAVED" || entry.state == "PEER_RECEIVED" else { continue }
                _ = try? outbox.markServerAccepted(sosId: entry.sosId, digest: entry.digest, fromState: entry.state, nowMs: nowMs)
            }
        }
        if carriedAndVerified {
            relayDeliveryCounter?.markCarriedMessagesDelivered([t.messageId])
        }
        seen.mark(t.messageKey, state: .delivered, nowMs: nowMs)
    }

    // MARK: Central side

    /// Up to 8 offer candidates for one peer: own SOS first, then carried copies routed toward
    /// a lower `h` (or sprayed while this device is offline).
    public func candidates(forPeer peerId: String, peerHops: UInt8, nowMs: Int64) -> [Candidate] {
        let selfHops = hops.compute(nowMs: nowMs)
        var out: [Candidate] = []
        let entries = (try? outbox.listEntries()) ?? []
        for entry in entries where entry.origin != SosOutboxService.relayOrigin {
            guard entry.state == "LOCAL_SAVED" || entry.state == "PEER_RECEIVED",
                  entry.retryAtMs <= nowMs,
                  let l2 = Data(base64Encoded: entry.encryptedBlobBase64) else { continue }
            let key = MeshV2.messageKey(entry.sosId)
            let sent = seen.sentPeers(key)
            guard !sent.contains(peerId), entry.state == "LOCAL_SAVED" || sent.count < MeshV2.maxPeersPerCopy,
                  tombstones.tombstone(forKey: key, nowMs: nowMs) == nil,
                  let payload = MeshCarry.encode(MeshCarry.wrap(l2: l2, messageId: entry.sosId, nowMs: nowMs)) else { continue }
            out.append(Candidate(messageId: entry.sosId, key: key, trackerSosId: entry.sosId, trackerDigest: entry.digest, payload: payload, isOwn: true))
        }
        let forwardAllowed = selfHops != 0 && (peerHops < selfHops || selfHops == MeshV2.offline)
        if forwardAllowed {
            let carriedEntries = MeshUploadOrdering.ordered(entries.filter { $0.origin == SosOutboxService.relayOrigin && $0.state == "LOCAL_SAVED" })
            for entry in carriedEntries {
                let key = MeshV2.messageKey(entry.sosId)
                let sent = seen.sentPeers(key)
                guard !sent.contains(peerId), sent.count < MeshV2.maxPeersPerCopy,
                      let blob = Data(base64Encoded: entry.encryptedBlobBase64),
                      let decoded = MeshCarry.decodeStored(blob, nowMs: nowMs),
                      case .success(let next) = MeshCarry.nextHop(decoded.envelope, selfDeviceHash: deviceHash, nowMs: nowMs),
                      let payload = MeshCarry.encode(next) else { continue }
                out.append(Candidate(messageId: entry.sosId, key: key, trackerSosId: entry.sosId, trackerDigest: MeshV2Node.carryDigestPrefix + entry.digest, payload: payload, isOwn: false))
            }
        }
        return Array(out.prefix(MeshV2.maxOfferKeys))
    }

    /// Own SOS for a v1 peer: the bare L2 message (ble-v1 compatible).
    public func legacyOwnCandidate(nowMs: Int64) -> Candidate? {
        let entries = (try? outbox.listEntries()) ?? []
        guard let entry = entries.first(where: { $0.origin != SosOutboxService.relayOrigin && $0.state == "LOCAL_SAVED" && $0.retryAtMs <= nowMs }),
              let l2 = Data(base64Encoded: entry.encryptedBlobBase64) else { return nil }
        return Candidate(messageId: entry.sosId, key: MeshV2.messageKey(entry.sosId), trackerSosId: entry.sosId, trackerDigest: entry.digest, payload: l2, isOwn: true)
    }

    /// The peer answered HAVE/DELIVERED or verified the transfer: never send it there again.
    public func noteSent(messageId: String, to peerId: String, nowMs: Int64) {
        seen.recordSent(MeshV2.messageKey(messageId), to: peerId, nowMs: nowMs)
    }

    public func tombstoneBatch(for peerId: String, nowMs: Int64) -> (payload: Data, ids: [String])? {
        let pending = tombstones.pending(for: peerId, nowMs: nowMs)
        guard !pending.isEmpty, let data = try? JSONEncoder().encode(TombstoneBatchV2(items: pending)) else { return nil }
        return (data, pending.map(\.messageId))
    }
}
