import Foundation

final class RelayDeliveryCounter {
    private let defaults: UserDefaults
    private let key = "sosmesh.relay_delivered_messages"
    
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }
    
    func recordDelivered(messageId: String) {
        var delivered = deliveredMessageIds()
        if delivered.insert(messageId).inserted {
            persist(delivered)
        }
    }
    
    func deliveredCount() -> Int {
        deliveredMessageIds().count
    }
    
    private func deliveredMessageIds() -> Set<String> {
        guard let data = defaults.data(forKey: key),
              let ids = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return Set(ids)
    }
    
    private func persist(_ ids: Set<String>) {
        if let data = try? JSONEncoder().encode(Array(ids)) {
            defaults.set(data, forKey: key)
        }
    }
}
