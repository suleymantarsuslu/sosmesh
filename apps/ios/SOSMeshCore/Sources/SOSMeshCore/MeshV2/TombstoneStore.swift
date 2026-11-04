import Foundation

/// Verifies a delivery tombstone with the bundled receipt key (§6 steps 1-3).
public struct TombstoneVerifier {
    private let verifier: ServerReceiptVerifier
    private let hasKey: Bool

    public init(publicKeySpkiBase64: String) {
        verifier = ServerReceiptVerifier(publicKeySpkiBase64: publicKeySpkiBase64)
        hasKey = !publicKeySpkiBase64.isEmpty
    }

    public func verify(_ t: DeliveryTombstone, nowMs: Int64) -> Bool {
        // Builds without a key (DEBUG) never purge anything.
        guard hasKey, t.ackType == "SERVER_ACCEPTED",
              t.packetHash.count == 64, t.messageId.utf8.count <= 64,
              let signedMs = MeshV2.parseISO8601Ms(t.timestamp),
              nowMs <= signedMs + MeshV2.tombstoneTtlMs,
              signedMs <= nowMs + MeshV2.tombstoneFutureSkewMs else { return false }
        let receipt = ServerAcceptedReceipt(
            ackType: t.ackType, messageId: t.messageId, packetHash: t.packetHash,
            timestamp: t.timestamp, signature: t.signature, uploadToken: nil
        )
        return verifier.verify(receipt: receipt, expectedMessageId: t.messageId, expectedPacketHash: t.packetHash)
    }
}

/// Verified tombstones, kept until signed timestamp + 72 h (cap 1024).
public final class TombstoneStore: @unchecked Sendable {
    struct Stored: Codable {
        var tombstone: DeliveryTombstone
        var signedMs: Int64
        var pushedTo: [String]
    }

    private var items: [String: Stored] = [:]
    private let fileURL: URL?
    private let lock = NSLock()

    public init(fileURL: URL? = nil) {
        self.fileURL = fileURL
        if let fileURL, let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode([String: Stored].self, from: data) {
            items = decoded
        }
    }

    /// Stores an already verified tombstone. Returns false when it was known.
    @discardableResult
    public func add(_ t: DeliveryTombstone, nowMs: Int64) -> Bool {
        guard let signedMs = MeshV2.parseISO8601Ms(t.timestamp) else { return false }
        lock.lock()
        let key = MeshV2.hex(t.messageKey)
        if let existing = items[key], existing.tombstone.packetHash == t.packetHash {
            if (t.hopsLeft ?? 0) > (existing.tombstone.hopsLeft ?? 0) { items[key]?.tombstone.hopsLeft = t.hopsLeft }
            lock.unlock()
            return false
        }
        items[key] = Stored(tombstone: t, signedMs: signedMs, pushedTo: [])
        purgeUnlocked(nowMs: nowMs)
        lock.unlock()
        persist()
        return true
    }

    public func tombstone(forKey key: Data, nowMs: Int64) -> DeliveryTombstone? {
        lock.lock(); defer { lock.unlock() }
        guard let s = items[MeshV2.hex(key)], nowMs <= s.signedMs + MeshV2.tombstoneTtlMs else { return nil }
        return s.tombstone
    }

    /// Forwardable tombstones (hopsLeft > 0) not yet pushed to `peerId`, already decremented.
    public func pending(for peerId: String, nowMs: Int64, limit: Int = MeshV2.maxTombstoneBatch) -> [DeliveryTombstone] {
        lock.lock(); defer { lock.unlock() }
        return items.values
            .filter { nowMs <= $0.signedMs + MeshV2.tombstoneTtlMs && ($0.tombstone.hopsLeft ?? 0) > 0 && !$0.pushedTo.contains(peerId) }
            .sorted { $0.signedMs > $1.signedMs }
            .prefix(limit)
            .map { var t = $0.tombstone; t.hopsLeft = ($0.tombstone.hopsLeft ?? 1) - 1; return t }
    }

    public func markPushed(_ messageIds: [String], to peerId: String) {
        lock.lock()
        for id in messageIds {
            let key = MeshV2.hex(MeshV2.messageKey(id))
            if items[key]?.pushedTo.contains(peerId) == false { items[key]?.pushedTo.append(peerId) }
        }
        lock.unlock()
        persist()
    }

    public var count: Int {
        lock.lock(); defer { lock.unlock() }
        return items.count
    }

    public func purge(nowMs: Int64) {
        lock.lock(); purgeUnlocked(nowMs: nowMs); lock.unlock()
        persist()
    }

    private func purgeUnlocked(nowMs: Int64) {
        items = items.filter { nowMs <= $0.value.signedMs + MeshV2.tombstoneTtlMs }
        if items.count > MeshV2.tombstoneCapacity {
            let sorted = items.sorted { $0.value.signedMs < $1.value.signedMs }
            for (key, _) in sorted.prefix(items.count - MeshV2.tombstoneCapacity) { items.removeValue(forKey: key) }
        }
    }

    private func persist() {
        guard let fileURL else { return }
        lock.lock()
        let data = try? JSONEncoder().encode(items)
        lock.unlock()
        if let data { MeshV2.writeProtected(data, to: fileURL) }
    }
}
