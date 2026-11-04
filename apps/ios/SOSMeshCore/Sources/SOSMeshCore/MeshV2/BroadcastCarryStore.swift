import Foundation

public struct CarriedBroadcast {
    public let id: String
    public let broadcast: ServerBroadcast
    public let receivedAtMs: Int64
    
    public init(id: String, broadcast: ServerBroadcast, receivedAtMs: Int64) {
        self.id = id
        self.broadcast = broadcast
        self.receivedAtMs = receivedAtMs
    }
}

public final class BroadcastCarryStore {
    private let maxCapacity: Int
    private let lock = NSLock()
    private var carried: [String: CarriedBroadcast] = [:]
    private var pushedToPeers: [String: Set<String>] = [:]
    
    public init(maxCapacity: Int = 20) {
        self.maxCapacity = maxCapacity
    }
    
    public func put(_ broadcast: ServerBroadcast, receivedAtMs: Int64) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        
        if carried.count >= maxCapacity && carried[broadcast.id] == nil {
            return false
        }
        carried[broadcast.id] = CarriedBroadcast(id: broadcast.id, broadcast: broadcast, receivedAtMs: receivedAtMs)
        return true
    }
    
    public func contains(_ id: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return carried[id] != nil
    }
    
    public func ordered() -> [CarriedBroadcast] {
        lock.lock()
        defer { lock.unlock() }
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        return carried.values
            .filter { c in
                guard let expiresAt = MeshV2.parseISO8601Ms(c.broadcast.expiresAt) else { return false }
                return expiresAt > nowMs
            }
            .sorted { $0.receivedAtMs < $1.receivedAtMs }
    }
    
    public func takeForPeer(_ peerId: String, nowMs: Int64) -> ServerBroadcast? {
        lock.lock()
        defer { lock.unlock() }
        
        for broadcast in carried.values.sorted(by: { $0.receivedAtMs < $1.receivedAtMs }) {
            if broadcast.broadcast.hopsLeft <= 0 {
                continue
            }
            
            guard let expiresAt = MeshV2.parseISO8601Ms(broadcast.broadcast.expiresAt) else { continue }
            if expiresAt <= nowMs {
                continue
            }
            
            let sent = pushedToPeers[broadcast.id] ?? []
            if sent.contains(peerId) {
                continue
            }
            
            pushedToPeers[broadcast.id, default: []].insert(peerId)
            
            return ServerBroadcast(
                id: broadcast.broadcast.id,
                title: broadcast.broadcast.title,
                body: broadcast.broadcast.body,
                severity: broadcast.broadcast.severity,
                createdAt: broadcast.broadcast.createdAt,
                expiresAt: broadcast.broadcast.expiresAt,
                regionLat: broadcast.broadcast.regionLat,
                regionLng: broadcast.broadcast.regionLng,
                regionRadiusKm: broadcast.broadcast.regionRadiusKm,
                signature: broadcast.broadcast.signature,
                hopsLeft: broadcast.broadcast.hopsLeft - 1
            )
        }
        return nil
    }
    
    public func prune(nowMs: Int64) {
        lock.lock()
        defer { lock.unlock() }
        
        carried = carried.filter { _, c in
            guard let expiresAt = MeshV2.parseISO8601Ms(c.broadcast.expiresAt) else { return false }
            return expiresAt > nowMs
        }
    }
}
