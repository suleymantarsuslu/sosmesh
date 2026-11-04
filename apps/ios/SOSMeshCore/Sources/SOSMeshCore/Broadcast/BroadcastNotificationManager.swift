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

        if broadcast.kind == "relay_request" {
            content.categoryIdentifier = "RELAY_REQUEST"
            let center = UNUserNotificationCenter.current()
            let enableAction = UNNotificationAction(
                identifier: "ENABLE_RELAY",
                title: NSLocalizedString("broadcast.relay_request.action.enable", comment: ""),
                options: [.foreground]
            )
            let cancelAction = UNNotificationAction(
                identifier: "CANCEL",
                title: NSLocalizedString("broadcast.relay_request.action.cancel", comment: ""),
                options: []
            )
            let category = UNNotificationCategory(
                identifier: "RELAY_REQUEST",
                actions: [enableAction, cancelAction],
                intentIdentifiers: [],
                options: []
            )
            center.setNotificationCategories([category])
        }

        let request = UNNotificationRequest(
            identifier: broadcast.id,
            content: content,
            trigger: nil
        )

        try? await UNUserNotificationCenter.current().add(request)
    }
}
