import Foundation
import SOSMeshContracts

public struct IosSosComposeRequest: Sendable {
    public var note: String
    public var languageTag: String
    public var nowMs: Int64
    public var messageIdOverride: String?

    public init(note: String, languageTag: String, nowMs: Int64, messageIdOverride: String? = nil) {
        self.note = note
        self.languageTag = languageTag
        self.nowMs = nowMs
        self.messageIdOverride = messageIdOverride
    }
}

public struct IosComposedSosMessage: Sendable {
    public let message: SosMessage
    public let messageJson: String
    public let encryptedBlobBase64: String
    public let digest: String
    public let wirePayload: Data
}

public struct IosSosMessageComposer: Sendable {
    private let cryptoConfig: CryptoConfig

    public init(cryptoConfig: CryptoConfig) {
        self.cryptoConfig = cryptoConfig
    }

    public func compose(_ request: IosSosComposeRequest) throws -> IosComposedSosMessage {
        let isoTimestamp = iso8601(fromMs: request.nowMs)
        let messageId = request.messageIdOverride?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
            ?? UUID().uuidString.lowercased()
        let trimmedNote = request.note.trimmingCharacters(in: .whitespacesAndNewlines)
        let noteField: String? = trimmedNote.isEmpty ? nil : trimmedNote

        struct InnerPayload: Encodable {
            var sos_type: String
            var person_count: Int?
            var note: String?
            var language: String
        }

        let inner = InnerPayload(
            sos_type: "GENERAL",
            person_count: nil,
            note: noteField,
            language: normalizeLanguage(request.languageTag)
        )
        let innerEncoder = JSONEncoder()
        innerEncoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let innerBytes = try innerEncoder.encode(inner)

        let envelopeMap: [String: Any] = [
            "timestamp": isoTimestamp,
            "locationStatus": LocationStatusWire.unknown.rawValue,
            "location": NSNull(),
            "priority": 1,
        ]

        let encrypted = try SOSMeshCrypto.encryptPayload(innerBytes, envelope: envelopeMap, config: cryptoConfig)
        let encryptedPayloadString = try encodeEncryptedPayload(encrypted)

        let envelope = Envelope(
            timestamp: isoTimestamp,
            locationStatus: .unknown,
            location: nil,
            priority: 1,
            ackLevel: "DEVICE_STORED",
            relayCount: 0
        )

        let message = SosMessage(
            version: 1,
            id: messageId,
            envelope: envelope,
            encryptedPayload: encryptedPayloadString,
            signature: nil
        )

        let messageJson = try encodeMessageJson(message)
        let messageBytes = Data(messageJson.utf8)
        let digestData = BleProtocol.calculateSHA256(messageBytes)
        let digest = digestData.base64EncodedString()
        let blob = messageBytes.base64EncodedString()

        return IosComposedSosMessage(
            message: message,
            messageJson: messageJson,
            encryptedBlobBase64: blob,
            digest: digest,
            wirePayload: messageBytes
        )
    }

    private func encodeEncryptedPayload(_ encrypted: EncryptedPayload) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return String(data: try encoder.encode(encrypted), encoding: .utf8) ?? ""
    }

    private func encodeMessageJson(_ message: SosMessage) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return String(data: try encoder.encode(message), encoding: .utf8) ?? ""
    }

    private func iso8601(fromMs ms: Int64) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000.0)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    private func normalizeLanguage(_ tag: String) -> String {
        tag.lowercased().hasPrefix("tr") ? "tr" : "en"
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
