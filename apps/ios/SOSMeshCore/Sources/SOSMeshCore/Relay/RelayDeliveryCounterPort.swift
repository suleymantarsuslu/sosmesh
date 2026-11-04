import Foundation

/// Protocol for tracking relay delivery counts across carriers
public protocol RelayDeliveryCounterPort: AnyObject {
    func recordCarriedMessage(messageId: String)
    func markCarriedMessagesDelivered(_ messageIds: [String])
    func getPendingCarriedIds() -> [String]
    func deliveredCount() -> Int
}
