import Foundation

/// Tracks which peers have successfully received each message for fan-out delivery.
/// A message stays in LOCAL_SAVED until all currently discovered peers have received it.
public actor PeerDeliveryRecordStore {
    private var deliveredPeers: [String: Set<String>] = [:]
    
    public init() {}
    
    public func recordDelivery(sosId: String, peerId: String) {
        deliveredPeers[sosId, default: []].insert(peerId)
    }
    
    public func getDeliveredPeers(sosId: String) -> Set<String> {
        deliveredPeers[sosId] ?? []
    }
    
    public func hasDeliveredToAll(sosId: String, allDiscoveredPeerIds: Set<String>) -> Bool {
        guard !allDiscoveredPeerIds.isEmpty else { return true }
        let delivered = deliveredPeers[sosId] ?? []
        return allDiscoveredPeerIds.isSubset(of: delivered)
    }
    
    public func clearMessageRecords(sosId: String) {
        deliveredPeers.removeValue(forKey: sosId)
    }
    
    public func getAllTrackedMessages() -> Set<String> {
        Set(deliveredPeers.keys)
    }
}
