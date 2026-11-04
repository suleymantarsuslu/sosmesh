import Foundation

public actor BroadcastStore {
    private var seenIds: Set<String> = []
    private var lastFetchTime: Date?
    private let maxSeenCache = 500

    public init() {}

    public func isSeen(_ id: String) -> Bool {
        seenIds.contains(id)
    }

    public func markSeen(_ id: String) {
        seenIds.insert(id)
        if seenIds.count > maxSeenCache {
            let toRemove = seenIds.prefix(maxSeenCache / 2)
            seenIds.subtract(toRemove)
        }
    }

    public func getLastFetchTime() -> Date? {
        lastFetchTime
    }

    public func updateLastFetchTime(_ time: Date = Date()) {
        lastFetchTime = time
    }
}
