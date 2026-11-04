import Foundation
import UserNotifications

public struct BroadcastNotificationManager {
    public init() {}

    public func showNotification(broadcast: ServerBroadcast) async {
        let content = UNMutableNotificationContent()
        content.title = broadcast.title
        content.body = broadcast.body
        content.sound = .default

        switch broadcast.severity {
        case "critical":
            content.interruptionLevel = .critical
        case "warning":
            content.interruptionLevel = .timeSensitive
        default:
            content.interruptionLevel = .active
        }

        let request = UNNotificationRequest(
            identifier: broadcast.id,
            content: content,
            trigger: nil
        )

        try? await UNUserNotificationCenter.current().add(request)
    }
}
