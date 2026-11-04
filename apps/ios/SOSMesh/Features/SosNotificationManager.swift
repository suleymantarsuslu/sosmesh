import Foundation
import UserNotifications

@MainActor
final class SosNotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = SosNotificationManager()
    
    var pendingSosIds: Set<String> = []
    private let notificationCenter = UNUserNotificationCenter.current()
    
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
        if response.notification.request.content.userInfo["action"] as? String == "viewStatus" {
            NotificationCenter.default.post(name: .navigateToStatusTab, object: nil)
        }
        completionHandler()
    }
}

extension Notification.Name {
    static let navigateToStatusTab = Notification.Name("navigateToStatusTab")
}
