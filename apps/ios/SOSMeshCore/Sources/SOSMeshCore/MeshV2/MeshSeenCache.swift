import Foundation

/// Per-device seen cache keyed by `messageKey` (§3.1): 72 h, LRU capped. Holds no payloads.
public final class MeshSeenCache: @unchecked Sendable {
    public enum State: String, Codable {
        case carrying = "CARRYING"
        case forwarded = "FORWARDED"
        case delivered = "DELIVERED"
    }

    struct Entry: Codable {
        var state: State
        var firstSeenMs: Int64
        var touchedMs: Int64
        var sentTo: [String]
    }

    private var entries: [String: Entry] = [:]
    private let fileURL: URL?
    private let capacity: Int
    private let lock = NSLock()

    public init(fileURL: URL? = nil, capacity: Int = MeshV2.seenCacheCapacity) {
        self.fileURL = fileURL
        self.capacity = capacity
        if let fileURL, let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode([String: Entry].self, from: data) {
            entries = decoded
        }
    }

    public func state(for key: Data, nowMs: Int64) -> State? {
        lock.lock(); defer { lock.unlock() }
        guard let e = entries[MeshV2.hex(key)], nowMs - e.firstSeenMs <= MeshV2.seenCacheTtlMs else { return nil }
        return e.state
    }

    public func mark(_ key: Data, state: State, nowMs: Int64) {
        lock.lock()
        let id = MeshV2.hex(key)
        var e = entries[id] ?? Entry(state: state, firstSeenMs: nowMs, touchedMs: nowMs, sentTo: [])
        // DELIVERED is final for the cache lifetime.
        if e.state != .delivered { e.state = state }
        e.touchedMs = nowMs
        entries[id] = e
        evictUnlocked(nowMs: nowMs)
        lock.unlock()
        persist()
    }

    public func recordSent(_ key: Data, to peerId: String, nowMs: Int64) {
        lock.lock()
        let id = MeshV2.hex(key)
        var e = entries[id] ?? Entry(state: .forwarded, firstSeenMs: nowMs, touchedMs: nowMs, sentTo: [])
        if !e.sentTo.contains(peerId) { e.sentTo.append(peerId) }
        if e.state == .carrying { e.state = .forwarded }
        e.touchedMs = nowMs
        entries[id] = e
        lock.unlock()
        persist()
    }

    public func sentPeers(_ key: Data) -> [String] {
        lock.lock(); defer { lock.unlock() }
        return entries[MeshV2.hex(key)]?.sentTo ?? []
    }

    public var count: Int {
        lock.lock(); defer { lock.unlock() }
        return entries.count
    }

    public func purge(nowMs: Int64) {
        lock.lock()
        evictUnlocked(nowMs: nowMs)
        lock.unlock()
        persist()
    }

    private func evictUnlocked(nowMs: Int64) {
        entries = entries.filter { nowMs - $0.value.firstSeenMs <= MeshV2.seenCacheTtlMs }
        if entries.count > capacity {
            let sorted = entries.sorted { $0.value.touchedMs < $1.value.touchedMs }
            for (key, _) in sorted.prefix(entries.count - capacity) { entries.removeValue(forKey: key) }
        }
    }

    private func persist() {
        guard let fileURL else { return }
        lock.lock()
        let data = try? JSONEncoder().encode(entries)
        lock.unlock()
        if let data { MeshV2.writeProtected(data, to: fileURL) }
    }
}
