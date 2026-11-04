import Foundation

final class DeliveredModalTracker {
    private let defaults: UserDefaults
    private let key = "sosmesh.delivered_modals_shown"
    
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }
    
    func shouldShowModal(for sosId: String) -> Bool {
        let shown = shownMessageIds()
        return !shown.contains(sosId)
    }
    
    func markModalShown(for sosId: String) {
        var shown = shownMessageIds()
        shown.insert(sosId)
        if let data = try? JSONEncoder().encode(Array(shown)) {
            defaults.set(data, forKey: key)
        }
    }
    
    private func shownMessageIds() -> Set<String> {
        guard let data = defaults.data(forKey: key),
              let ids = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return Set(ids)
    }
}
