import Foundation

public actor BroadcastStore {
    private var seenIds: Set<String> = []
    private var lastFetchTime: Date?
    private let maxSeenCache = 500
    private let defaults = UserDefaults.standard
    private let seenKey = "broadcast_seen_ids"
    private let lastFetchKey = "broadcast_last_fetch"

    public init() {
        if let saved = defaults.array(forKey: seenKey) as? [String] {
            seenIds = Set(saved)
        }
        if let saved = defaults.object(forKey: lastFetchKey) as? Date {
            lastFetchTime = saved
        }
    }

    public func isSeen(_ id: String) -> Bool {
        seenIds.contains(id)
    }

    public func markSeen(_ id: String) {
        seenIds.insert(id)
        if seenIds.count > maxSeenCache {
            let toRemove = Array(seenIds.prefix(maxSeenCache / 2))
            seenIds.subtract(toRemove)
        }
        defaults.set(Array(seenIds), forKey: seenKey)
    }

    public func getLastFetchTime() -> Date? {
        lastFetchTime
    }

    public func updateLastFetchTime(_ time: Date = Date()) {
        lastFetchTime = time
        defaults.set(time, forKey: lastFetchKey)
    }
}
