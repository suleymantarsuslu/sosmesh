import Foundation

public struct WatchOutboundEntry: Equatable, Sendable {
    public let messageId: String
    public let nonce: String
    public let wire: WatchSosCreateWire
    public let status: String
    public let attemptCount: Int
    public let nextRetryAtMs: Int64
    public let lastError: String?
    public let updatedAtMs: Int64
    public let phoneAckDigest: String?

    public init(
        messageId: String,
        nonce: String,
        wire: WatchSosCreateWire,
        status: String,
        attemptCount: Int,
        nextRetryAtMs: Int64,
        lastError: String?,
        updatedAtMs: Int64,
        phoneAckDigest: String? = nil
    ) {
        self.messageId = messageId
        self.nonce = nonce
        self.wire = wire
        self.status = status
        self.attemptCount = attemptCount
        self.nextRetryAtMs = nextRetryAtMs
        self.lastError = lastError
        self.updatedAtMs = updatedAtMs
        self.phoneAckDigest = phoneAckDigest
    }
}

public protocol WatchOfflineQueueStore: Sendable {
    func get(messageId: String) -> WatchOutboundEntry?
    func listAll() -> [WatchOutboundEntry]
    func upsert(_ entry: WatchOutboundEntry)
    func remove(messageId: String)
}

public final class InMemoryWatchOfflineQueueStore: WatchOfflineQueueStore, @unchecked Sendable {
    private var entries: [String: WatchOutboundEntry] = [:]
    private let lock = NSLock()

    public init() {}

    public func get(messageId: String) -> WatchOutboundEntry? {
        lock.lock()
        defer { lock.unlock() }
        return entries[messageId]
    }

    public func listAll() -> [WatchOutboundEntry] {
        lock.lock()
        defer { lock.unlock() }
        return Array(entries.values)
    }

    public func upsert(_ entry: WatchOutboundEntry) {
        lock.lock()
        defer { lock.unlock() }
        entries[entry.messageId] = entry
    }

    public func remove(messageId: String) {
        lock.lock()
        defer { lock.unlock() }
        entries.removeValue(forKey: messageId)
    }
}

public enum WatchRetryPolicy {
    private static let backoffMs: [Int64] = [5_000, 15_000, 60_000, 300_000]

    public static func nextRetryAtMs(attemptCount: Int, nowMs: Int64) -> Int64 {
        let index = min(max(attemptCount - 1, 0), backoffMs.count - 1)
        return nowMs + backoffMs[index]
    }

    public static func shouldRetry(entry: WatchOutboundEntry, nowMs: Int64) -> Bool {
        entry.status != WatchOutboundWireStatus.phoneQueued && nowMs >= entry.nextRetryAtMs
    }
}

public struct WatchOfflineQueue: Sendable {
    private let store: WatchOfflineQueueStore

    public init(store: WatchOfflineQueueStore) {
        self.store = store
    }

    public func enqueueOrGetExisting(
        wire: WatchSosCreateWire,
        nowMs: Int64,
        phoneReachable: Bool
    ) -> WatchOutboundEntry {
        if let existing = store.get(messageId: wire.messageId) {
            return existing
        }
        let initialStatus =
            phoneReachable
            ? WatchOutboundWireStatus.awaitingPhone
            : WatchOutboundWireStatus.phoneUnreachable
        let entry = WatchOutboundEntry(
            messageId: wire.messageId,
            nonce: wire.nonce,
            wire: wire,
            status: initialStatus,
            attemptCount: 0,
            nextRetryAtMs: nowMs,
            lastError: phoneReachable ? nil : "phone_not_reachable",
            updatedAtMs: nowMs
        )
        store.upsert(entry)
        return entry
    }

    public func markSendAttemptFailed(
        messageId: String,
        nowMs: Int64,
        error: String
    ) -> WatchOutboundEntry? {
        guard let existing = store.get(messageId: messageId) else { return nil }
        let attempts = existing.attemptCount + 1
        let updated = WatchOutboundEntry(
            messageId: existing.messageId,
            nonce: existing.nonce,
            wire: existing.wire,
            status: WatchOutboundWireStatus.phoneUnreachable,
            attemptCount: attempts,
            nextRetryAtMs: WatchRetryPolicy.nextRetryAtMs(attemptCount: attempts, nowMs: nowMs),
            lastError: error,
            updatedAtMs: nowMs,
            phoneAckDigest: existing.phoneAckDigest
        )
        store.upsert(updated)
        return updated
    }

    public func applyPhoneAck(
        messageId: String,
        nonce: String,
        ackStatus: String,
        outboxDigest: String?,
        nowMs: Int64
    ) -> WatchOutboundEntry? {
        guard let existing = store.get(messageId: messageId) else { return nil }
        if existing.nonce != nonce {
            return existing
        }
        let updated: WatchOutboundEntry
        switch ackStatus {
        case WatchPhoneAckStatus.queued, WatchPhoneAckStatus.duplicate:
            updated = WatchOutboundEntry(
                messageId: existing.messageId,
                nonce: existing.nonce,
                wire: existing.wire,
                status: WatchOutboundWireStatus.phoneQueued,
                attemptCount: existing.attemptCount,
                nextRetryAtMs: existing.nextRetryAtMs,
                lastError: nil,
                updatedAtMs: nowMs,
                phoneAckDigest: outboxDigest
            )
        default:
            updated = WatchOutboundEntry(
                messageId: existing.messageId,
                nonce: existing.nonce,
                wire: existing.wire,
                status: WatchOutboundWireStatus.failed,
                attemptCount: existing.attemptCount,
                nextRetryAtMs: existing.nextRetryAtMs,
                lastError: ackStatus,
                updatedAtMs: nowMs,
                phoneAckDigest: existing.phoneAckDigest
            )
        }
        store.upsert(updated)
        return updated
    }

    public func listDueForRetry(nowMs: Int64) -> [WatchOutboundEntry] {
        store.listAll().filter { WatchRetryPolicy.shouldRetry(entry: $0, nowMs: nowMs) }
    }
}
