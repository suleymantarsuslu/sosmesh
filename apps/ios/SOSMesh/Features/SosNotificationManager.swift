import Foundation
import UserNotifications

@MainActor
final class SosNotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = SosNotificationManager()
    
    var pendingSosIds: Set<String> = []
    private let notificationCenter = UNUserNotificationCenter.current()
    private static let notifiedIncomingKey = "sosmesh.notifiedIncomingSosIds"
    private var notifiedIncomingSosIds: Set<String> = Set(
        UserDefaults.standard.stringArray(forKey: SosNotificationManager.notifiedIncomingKey) ?? []
    )

    /// First run after install/update: remember already-stored SOS ids without notifying,
    /// so old inbox records loaded from disk don't fire a burst of alerts.
    func seedIncomingIfNeeded(_ sosIds: [String]) {
        guard UserDefaults.standard.object(forKey: Self.notifiedIncomingKey) == nil else { return }
        notifiedIncomingSosIds.formUnion(sosIds)
        persistNotifiedIncoming()
    }

    private func persistNotifiedIncoming() {
        UserDefaults.standard.set(Array(notifiedIncomingSosIds.suffix(500)), forKey: Self.notifiedIncomingKey)
    }
    
    override init() {
        super.init()
        notificationCenter.delegate = self
    }
    
    func requestPermissionIfNeeded() async -> Bool {
        let settings = await notificationCenter.notificationSettings()
        
        switch settings.authorizationStatus {
        case .authorized:
            return true
        case .notDetermined:
            do {
                return try await notificationCenter.requestAuthorization(options: [.alert, .sound, .badge])
            } catch {
                return false
            }
        default:
            return false
        }
    }
    
    func trackPendingSos(sosId: String) {
        pendingSosIds.insert(sosId)
    }
    
    func notifyServerAccepted(sosId: String) {
        guard pendingSosIds.contains(sosId) else { return }
        pendingSosIds.remove(sosId)
        
        let content = UNMutableNotificationContent()
        content.title = NSLocalizedString("notification.sos.delivered.title", comment: "")
        content.body = NSLocalizedString("notification.sos.delivered.body", comment: "")
        content.sound = .default
        content.userInfo = ["sosId": sosId, "action": "viewStatus"]
        
        let request = UNNotificationRequest(
            identifier: "sos-delivered-\(sosId)",
            content: content,
            trigger: nil
        )
        
        notificationCenter.add(request) { error in
            if let error = error {
                print("Failed to post notification: \(error.localizedDescription)")
            }
        }
    }
    
    func notifyIncomingSos(sosId: String, isRelayOnly: Bool) {
        guard !notifiedIncomingSosIds.contains(sosId) else { return }
        notifiedIncomingSosIds.insert(sosId)
        persistNotifiedIncoming()
        
        let content = UNMutableNotificationContent()
        content.title = NSLocalizedString("notification.incoming.sos.title", comment: "")
        
        if isRelayOnly {
            content.body = NSLocalizedString("notification.incoming.sos.body.relay", comment: "")
        } else {
            content.body = NSLocalizedString("notification.incoming.sos.body.full", comment: "")
        }
        
        content.sound = .default
        content.userInfo = ["sosId": sosId, "action": "viewRelay", "incoming": true]
        
        let request = UNNotificationRequest(
            identifier: "incoming-sos-\(sosId)",
            content: content,
            trigger: nil
        )
        
        notificationCenter.add(request)
        
        let historyItem = NotificationHistoryItem(
            id: "incoming-sos-\(sosId)",
            type: .incomingSOS,
            title: content.title,
            body: content.body,
            severity: nil,
            regionName: nil,
            sosId: sosId,
            timestampMs: Int64(Date().timeIntervalSince1970 * 1000),
            isRead: false
        )
        NotificationHistoryStore.shared.addItem(historyItem)
    }
    
    func scheduleTestNotification() {
        let content = UNMutableNotificationContent()
        content.title = NSLocalizedString("notification.test.title", comment: "")
        content.body = NSLocalizedString("notification.test.body", comment: "")
        content.sound = .default
        content.userInfo = ["action": "viewRelay", "test": true]
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        let request = UNNotificationRequest(
            identifier: "test-notification-\(UUID().uuidString)",
            content: content,
            trigger: trigger
        )
        
        notificationCenter.add(request)
    }
    
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .sound, .list])
        } else {
            completionHandler([.alert, .sound, .badge])
        }
    }
    
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        
        if response.actionIdentifier == "ENABLE_RELAY" {
            Task { @MainActor in
                await AppModel.shared.enableRelay()
            }
        } else if response.actionIdentifier == "CANCEL" {
            // Just dismiss
        } else if userInfo["action"] as? String == "viewStatus" {
            NotificationCenter.default.post(name: .navigateToStatusTab, object: nil)
        } else if userInfo["action"] as? String == "viewRelay" {
            NotificationCenter.default.post(name: .navigateToRelayTab, object: nil)
        }
        
        completionHandler()
    }
}

extension Notification.Name {
    static let navigateToStatusTab = Notification.Name("navigateToStatusTab")
    static let navigateToRelayTab = Notification.Name("navigateToRelayTab")
}
