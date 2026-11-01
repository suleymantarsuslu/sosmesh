import Foundation
import SOSMeshContracts

public struct MessageEnvelopeBuilder: Sendable {
    public init() {}

    public func buildWireMessage(
        sosId: String,
        timestamp: String,
        location: Location?,
        encryptedPayloadBase64: String,
        priority: Int = 1
    ) throws -> SosMessage {
        try SosEnvelopeRules.validateTimestamp(timestamp)
        let envelope = Envelope(
            timestamp: timestamp,
            locationStatus: location == nil ? .unknown : .gps,
            location: location,
            priority: priority,
            ackLevel: "PEER",
            relayCount: nil
        )
        return SosMessage(
            version: 1,
            id: sosId,
            envelope: envelope,
            encryptedPayload: encryptedPayloadBase64,
            signature: nil
        )
    }

    public func encodeToCanonicalJson(_ message: SosMessage) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(message)
    }
}
