import Foundation
import SOSMeshContracts

/// Outbox stand-in for senders without a BLE outbox (watchOS handoff): peer ACKs change nothing.
public final class NullOutboxQueueUpdater: OutboxQueueUpdating {
    public init() {}
    public func updateState(sosId: String, digest: String, state: String, nowMs: Int64, lastError: String?) throws -> OutboxEntryMeta? { nil }
    public func setRetryAt(sosId: String, digest: String, retryAtMs: Int64, lastError: String?) throws {}
}

/// One central-role visit to a peer (§5.2): OFFER → OFFER_REPLY → optional TOMBSTONE_REQUEST,
/// tombstone push, then one ble-v1 transfer per WANT item. No CoreBluetooth here (testable).
public final class MeshV2CentralSession {
    public enum Action: Equatable {
        case writeControl(Data)
        case transfer(sosId: String, digest: String, payload: Data)
        case finished
    }

    private enum Phase { case idle, awaitingReply, transferring, done }
    private enum Item { case candidate(MeshV2Node.Candidate), tombstones(Data, [String]), broadcast(ServerBroadcast), attachment(BleAttachmentBlob) }

    private let node: MeshV2Node
    public let peerId: String
    private let peerInfo: MeshInfo?
    /// Own photo/voice copies follow the SOS on the same link (§2.5). nil = none.
    private let attachments: BleAttachmentProviding?
    private var phase: Phase = .idle
    private var offered: [MeshV2Node.Candidate] = []
    private var queue: [Item] = []
    private var current: Item?
    private var replyDeadlineMs: Int64 = 0
    private var awaitingTombstones = 0
    private var tombstoneDeadlineMs: Int64 = 0

    public init(node: MeshV2Node, peerId: String, peerInfo: MeshInfo?, attachments: BleAttachmentProviding? = nil) {
        self.attachments = attachments
        self.node = node
        self.peerId = peerId
        self.peerInfo = peerInfo
    }

    public var isFinished: Bool { phase == .done }

    public func start(nowMs: Int64) -> [Action] {
        guard let info = peerInfo else {
            // v1 peer (no FFF4): only the own SOS, as a bare v1 message.
            if let own = node.legacyOwnCandidate(nowMs: nowMs) { queue = [.candidate(own)] }
            phase = .transferring
            return next(nowMs: nowMs)
        }
        node.hops.observe(peerId: peerId, hops: info.hops, selfKey: info.selfKey, parentKey: info.parentKey, linked: true, nowMs: nowMs)
        offered = node.candidates(forPeer: peerId, peerHops: info.hops, nowMs: nowMs)
        if offered.isEmpty {
            phase = .transferring
            if let batch = node.tombstoneBatch(for: peerId, nowMs: nowMs) { queue = [.tombstones(batch.payload, batch.ids)] }
            queue += attachmentItems(blockedSosIds: [])
            return next(nowMs: nowMs)
        }
        guard let frame = MeshV2Frame.offer(offered.map(\.key)).encode() else { return finish() }
        phase = .awaitingReply
        replyDeadlineMs = nowMs + MeshV2.offerReplyTimeoutMs
        return [.writeControl(frame)]
    }

    /// FFF3 notification carrying a v2 frame.
    public func handleNotification(_ data: Data, nowMs: Int64) -> [Action] {
        switch MeshV2Frame.decode(data) {
        case .offerReply(let statuses) where phase == .awaitingReply:
            return applyReply(statuses, nowMs: nowMs)
        case .tombstone(let t):
            node.ingestTombstone(t, nowMs: nowMs)
            awaitingTombstones = max(0, awaitingTombstones - 1)
            return phase == .transferring && current == nil ? next(nowMs: nowMs) : []
        default:
            return []
        }
    }

    public func tick(nowMs: Int64) -> [Action] {
        if phase == .awaitingReply, nowMs >= replyDeadlineMs {
            // No reply in 2 s: treat every offered item as WANT.
            return applyReply(Array(repeating: .want, count: offered.count), nowMs: nowMs)
        }
        if awaitingTombstones > 0, nowMs >= tombstoneDeadlineMs {
            awaitingTombstones = 0
            if phase == .transferring, current == nil { return next(nowMs: nowMs) }
        }
        return []
    }

    public func transferFinished(success: Bool, nowMs: Int64) -> [Action] {
        guard phase == .transferring, let item = current else { return [] }
        current = nil
        if success {
            switch item {
            case .candidate(let c):
                node.noteSent(messageId: c.messageId, to: peerId, nowMs: nowMs)
            case .tombstones(_, let ids):
                node.tombstones.markPushed(ids, to: peerId)
            case .broadcast:
                break
            case .attachment(let blob):
                attachments?.markDelivered(sosId: blob.sosId, attachmentId: blob.attachmentId, peerId: peerId)
            }
            return next(nowMs: nowMs)
        }
        // A failed transfer ends the visit; the link is probably gone.
        if case .attachment(let blob) = item {
            attachments?.markFailed(sosId: blob.sosId, attachmentId: blob.attachmentId, peerId: peerId)
        }
        return finish()
    }

    private func applyReply(_ statuses: [MeshOfferStatus], nowMs: Int64) -> [Action] {
        var actions: [Action] = []
        var deliveredKeys: [Data] = []
        var wanted: [MeshV2Node.Candidate] = []
        var blockedSosIds = Set<String>()
        for (index, candidate) in offered.enumerated() {
            let status = index < statuses.count ? statuses[index] : .want
            switch status {
            case .want: wanted.append(candidate)
            case .have:
                node.noteSent(messageId: candidate.messageId, to: peerId, nowMs: nowMs)
                if candidate.isOwn { node.notePeerHolds(messageId: candidate.messageId, nowMs: nowMs) }
            case .delivered:
                node.noteSent(messageId: candidate.messageId, to: peerId, nowMs: nowMs)
                deliveredKeys.append(candidate.key)
                blockedSosIds.insert(candidate.messageId)
            case .full, .refused:
                blockedSosIds.insert(candidate.messageId)
            }
        }
        if !deliveredKeys.isEmpty, let frame = MeshV2Frame.tombstoneRequest(deliveredKeys).encode() {
            actions.append(.writeControl(frame))
            awaitingTombstones = deliveredKeys.count
            tombstoneDeadlineMs = nowMs + MeshV2.offerReplyTimeoutMs
        }
        queue = []
        if let batch = node.tombstoneBatch(for: peerId, nowMs: nowMs) { queue.append(.tombstones(batch.payload, batch.ids)) }
        queue += wanted.map { .candidate($0) }
        if let broadcast = node.takeBroadcastFor(peerId: peerId, nowMs: nowMs) {
            queue.append(.broadcast(broadcast))
        }
        queue += attachmentItems(blockedSosIds: blockedSosIds)
        phase = .transferring
        return actions + next(nowMs: nowMs)
    }

    private func next(nowMs: Int64) -> [Action] {
        guard !queue.isEmpty else {
            return awaitingTombstones > 0 ? [] : finish()
        }
        let item = queue.removeFirst()
        current = item
        switch item {
        case .candidate(let c):
            return [.transfer(sosId: c.trackerSosId, digest: c.trackerDigest, payload: c.payload)]
        case .tombstones(let payload, _):
            return [.transfer(sosId: MeshV2Node.tombstoneBatchSosId, digest: "tombstones", payload: payload)]
        case .broadcast(let b):
            guard let payload = MeshV2Frame.broadcast(b).encode() else { return next(nowMs: nowMs) }
            return [.transfer(sosId: "broadcast-\(b.id)", digest: "", payload: payload)]
        case .attachment(let blob):
            return [.transfer(sosId: "att-\(blob.attachmentId)", digest: "", payload: blob.payload)]
        }
    }

    /// Attachment copies this peer still lacks, except for SOS the peer refused / already delivered (it would drop them).
    private func attachmentItems(blockedSosIds: Set<String>) -> [Item] {
        guard peerInfo != nil, let attachments else { return [] }
        return attachments.pendingBlobs(forPeer: peerId)
            .filter { !blockedSosIds.contains($0.sosId) }
            .map { .attachment($0) }
    }

    private func finish() -> [Action] {
        phase = .done
        return [.finished]
    }
}
