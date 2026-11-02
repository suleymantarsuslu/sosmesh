import Foundation

public struct WatchSosCreateWire: Codable, Equatable, Sendable {
    public var version: Int
    public let messageId: String
    public let nonce: String
    public let sosType: String
    public let personCount: Int?
    public let note: String
    public let language: String
    public let createdAtMs: Int64

    public init(
        version: Int = 1,
        messageId: String,
        nonce: String,
        sosType: String,
        personCount: Int? = nil,
        note: String = "",
        language: String = "tr",
        createdAtMs: Int64
    ) {
        self.version = version
        self.messageId = messageId
        self.nonce = nonce
        self.sosType = sosType
        self.personCount = personCount
        self.note = note
        self.language = language
        self.createdAtMs = createdAtMs
    }
}

public struct WatchPhoneAckWire: Codable, Equatable, Sendable {
    public var version: Int
    public let messageId: String
    public let nonce: String
    public let status: String
    public let outboxDigest: String?
    public let phoneNowMs: Int64
    public let detail: String?

    public init(
        version: Int = 1,
        messageId: String,
        nonce: String,
        status: String,
        outboxDigest: String? = nil,
        phoneNowMs: Int64,
        detail: String? = nil
    ) {
        self.version = version
        self.messageId = messageId
        self.nonce = nonce
        self.status = status
        self.outboxDigest = outboxDigest
        self.phoneNowMs = phoneNowMs
        self.detail = detail
    }
}

public enum WatchPhoneAckStatus {
    public static let queued = "PHONE_OUTBOX_QUEUED"
    public static let duplicate = "PHONE_OUTBOX_DUPLICATE"
    public static let rejected = "PHONE_REJECTED"
}

public enum WatchOutboundWireStatus {
    public static let localPending = "LOCAL_PENDING"
    public static let awaitingPhone = "AWAITING_PHONE"
    public static let phoneQueued = "PHONE_QUEUED"
    public static let phoneUnreachable = "PHONE_UNREACHABLE"
    public static let failed = "FAILED"
}
