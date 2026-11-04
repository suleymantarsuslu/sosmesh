import Foundation
import SOSMeshCore

final class RelayDeliveryCounter: RelayDeliveryCounterPort {
    private let defaults: UserDefaults
    private let deliveredKey = "sosmesh.relay_delivered_messages"
    private let carriedKey = "sosmesh.relay_carried_messages"
    private let maxCarriedIds = 500
    
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }
    
    func recordDelivered(messageId: String) {
        guard carriedMessageIds().contains(messageId) else { return }
        var delivered = deliveredMessageIds()
        if delivered.insert(messageId).inserted {
            persistDelivered(delivered)
        }
    }
    
    /// Only messages this device carried for someone else count; its own SOS uploads never do.
    func deliveredCount() -> Int {
        deliveredMessageIds().intersection(carriedMessageIds()).count
    }
    
    func recordCarriedMessage(messageId: String) {
        var carried = carriedMessageIds()
        if carried.insert(messageId).inserted {
            pruneCarriedMessages(&carried)
            persistCarried(carried)
        }
    }
    
    func getPendingCarriedIds() -> [String] {
        let carried = carriedMessageIds()
        let delivered = deliveredMessageIds()
        return carried.filter { !delivered.contains($0) }
    }
    
    func markCarriedMessagesDelivered(_ messageIds: [String]) {
        var delivered = deliveredMessageIds()
        var changed = false
        for id in messageIds {
            if delivered.insert(id).inserted {
                changed = true
            }
        }
        if changed {
            persistDelivered(delivered)
        }
    }
    
    private func pruneCarriedMessages(_ carried: inout Set<String>) {
        if carried.count > maxCarriedIds {
            let sorted = Array(carried).sorted()
            let toRemove = sorted.prefix(carried.count - maxCarriedIds)
            carried.subtract(toRemove)
        }
    }
    
    private func deliveredMessageIds() -> Set<String> {
        guard let data = defaults.data(forKey: deliveredKey),
              let ids = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return Set(ids)
    }
    
    private func carriedMessageIds() -> Set<String> {
        guard let data = defaults.data(forKey: carriedKey),
              let ids = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return Set(ids)
    }
    
    private func persistDelivered(_ ids: Set<String>) {
        if let data = try? JSONEncoder().encode(Array(ids)) {
            defaults.set(data, forKey: deliveredKey)
        }
    }
    
    private func persistCarried(_ ids: Set<String>) {
        if let data = try? JSONEncoder().encode(Array(ids)) {
            defaults.set(data, forKey: carriedKey)
        }
    }
}
