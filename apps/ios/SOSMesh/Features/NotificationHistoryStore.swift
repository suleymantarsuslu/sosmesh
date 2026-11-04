import Foundation

struct NotificationHistoryItem: Codable, Identifiable {
    let id: String
    let type: NotificationType
    let title: String
    let body: String
    let severity: String?
    let regionName: String?
    let sosId: String?
    let timestampMs: Int64
    var isRead: Bool
    
    enum NotificationType: String, Codable {
        case broadcast
        case incomingSOS
    }
}

@MainActor
class NotificationHistoryStore: ObservableObject {
    static let shared = NotificationHistoryStore()
    
    @Published private(set) var items: [NotificationHistoryItem] = []
    
    private let defaults = UserDefaults.standard
    private let itemsKey = "sosmesh.notificationHistory.items"
    private let maxItems = 200
    
    init() {
        loadItems()
    }
    
    var unreadCount: Int {
        items.filter { !$0.isRead }.count
    }
    
    func addItem(_ item: NotificationHistoryItem) {
        var updatedItems = items.filter { $0.id != item.id }
        updatedItems.insert(item, at: 0)
        
        if updatedItems.count > maxItems {
            updatedItems = Array(updatedItems.prefix(maxItems))
        }
        
        items = updatedItems
        saveItems()
    }
    
    func markAllRead() {
        items = items.map { var item = $0; item.isRead = true; return item }
        saveItems()
    }
    
    func clearAll() {
        items = []
        saveItems()
    }
    
    private func loadItems() {
        guard let data = defaults.data(forKey: itemsKey),
              let decoded = try? JSONDecoder().decode([NotificationHistoryItem].self, from: data) else {
            return
        }
        items = decoded
    }
    
    private func saveItems() {
        guard let encoded = try? JSONEncoder().encode(items) else { return }
        defaults.set(encoded, forKey: itemsKey)
    }
}
