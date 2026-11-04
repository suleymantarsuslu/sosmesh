import Foundation

/// Transitive gateway reachability `h` (§4.1). A routing hint only, never a delivery state.
public final class GatewayHopsTracker: @unchecked Sendable {
    public struct Neighbor: Equatable {
        public var hops: UInt8
        public var selfKey: UInt32?
        public var parentKey: UInt32?
        public var lastSeenMs: Int64
        public var linked: Bool
    }

    public private(set) var selfKey: UInt32
    private var neighbors: [String: Neighbor] = [:]
    private var lastInternetOkMs: Int64?
    private var current: UInt8 = MeshV2.offline
    private var parentId: String?
    private var lastChangeMs: Int64 = 0
    private var lastConfirmedMs: Int64 = 0
    private let lock = NSLock()

    public init(selfKey: UInt32) {
        self.selfKey = selfKey
    }

    public func updateSelfKey(_ key: UInt32) {
        lock.lock(); selfKey = key; lock.unlock()
    }

    /// A real HTTPS response from the SOSMesh API (2xx or 4xx). OS reachability alone never counts.
    public func noteInternetSuccess(nowMs: Int64) {
        lock.lock(); lastInternetOkMs = nowMs; lock.unlock()
    }

    public func noteInternetFailure() {
        lock.lock(); lastInternetOkMs = nil; lock.unlock()
    }

    /// Advertisement or MESH_INFO from a neighbour.
    public func observe(peerId: String, hops: UInt8, selfKey: UInt32? = nil, parentKey: UInt32? = nil, linked: Bool = false, nowMs: Int64) {
        lock.lock(); defer { lock.unlock() }
        var entry = neighbors[peerId] ?? Neighbor(hops: hops, lastSeenMs: nowMs, linked: linked)
        entry.hops = hops
        entry.lastSeenMs = nowMs
        if let selfKey { entry.selfKey = selfKey }
        if let parentKey { entry.parentKey = parentKey }
        entry.linked = entry.linked || linked
        neighbors[peerId] = entry
    }

    /// Disconnect / link failure: the neighbour no longer qualifies (recomputed immediately).
    public func linkLost(peerId: String) {
        lock.lock(); neighbors.removeValue(forKey: peerId); lock.unlock()
    }

    public func freshNeighbors(nowMs: Int64) -> [String: Neighbor] {
        lock.lock(); defer { lock.unlock() }
        return neighbors.filter { nowMs - $0.value.lastSeenMs <= MeshV2.neighborStaleMs }
    }

    public func hops(of peerId: String, nowMs: Int64) -> UInt8 {
        lock.lock(); defer { lock.unlock() }
        guard let n = neighbors[peerId], nowMs - n.lastSeenMs <= MeshV2.neighborStaleMs else { return MeshV2.offline }
        return n.hops
    }

    @discardableResult
    public func compute(nowMs: Int64) -> UInt8 {
        lock.lock(); defer { lock.unlock() }
        neighbors = neighbors.filter { nowMs - $0.value.lastSeenMs <= MeshV2.neighborStaleMs }
        if let ok = lastInternetOkMs, nowMs - ok <= MeshV2.gatewayFreshMs {
            set(0, parent: nil, nowMs: nowMs)
            lastConfirmedMs = ok
            return current
        }
        let candidates = neighbors.filter { entry in
            let n = entry.value
            guard n.hops <= UInt8(MeshV2.maxHops - 1) else { return false }
            // Loop damping: never derive from a neighbour that derived its value from us.
            if let parent = n.parentKey, parent != 0, parent == selfKey { return false }
            return true
        }
        guard let best = candidates.min(by: { ($0.value.hops, $0.key) < ($1.value.hops, $1.key) }) else {
            set(MeshV2.offline, parent: nil, nowMs: nowMs)
            return current
        }
        var next = best.value.hops + 1
        // Hold-down: a worse value is adopted at most +1 per 15 s while a path still exists.
        if current != MeshV2.offline, current != 0, next > current {
            next = nowMs - lastChangeMs >= MeshV2.holdDownMs ? current + 1 : current
        }
        set(next, parent: best.key, nowMs: nowMs)
        lastConfirmedMs = best.value.lastSeenMs
        return current
    }

    public var value: UInt8 {
        lock.lock(); defer { lock.unlock() }
        return current
    }

    public func parentKey() -> UInt32 {
        lock.lock(); defer { lock.unlock() }
        guard let parentId else { return 0 }
        return neighbors[parentId]?.selfKey ?? 0
    }

    public func secondsSinceConfirmed(nowMs: Int64) -> UInt16 {
        lock.lock(); defer { lock.unlock() }
        guard current != MeshV2.offline, lastConfirmedMs > 0 else { return UInt16.max }
        return UInt16(clamping: max(0, (nowMs - lastConfirmedMs) / 1000))
    }

    private func set(_ value: UInt8, parent: String?, nowMs: Int64) {
        if value != current { lastChangeMs = nowMs }
        current = value
        parentId = parent
    }
}
