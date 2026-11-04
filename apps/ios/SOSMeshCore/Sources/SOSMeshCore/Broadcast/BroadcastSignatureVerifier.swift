import CryptoKit
import Foundation

public struct BroadcastSignatureVerifier {
    private let publicKey: Curve25519.Signing.PublicKey

    public init(publicKeyBase64: String) throws {
        let keyData = Data(base64Encoded: publicKeyBase64)!
        let rawKeyData = keyData.dropFirst(12)
        self.publicKey = try Curve25519.Signing.PublicKey(rawRepresentation: rawKeyData)
    }

    public func verify(broadcast: ServerBroadcast) -> Bool {
        let regionPart: String
        if let lat = broadcast.regionLat, let lng = broadcast.regionLng, let radius = broadcast.regionRadiusKm {
            regionPart = "|\(Self.jsNumber(lat))|\(Self.jsNumber(lng))|\(Self.jsNumber(radius))"
        } else {
            regionPart = ""
        }
        let payload = "BROADCAST|\(broadcast.id)|\(broadcast.title)|\(broadcast.body)|\(broadcast.severity)|\(broadcast.createdAt)|\(broadcast.expiresAt)\(regionPart)"
        
        guard let payloadData = payload.data(using: .utf8),
              let signatureData = Data(base64Encoded: broadcast.signature) else {
            return false
        }
        
        return publicKey.isValidSignature(signatureData, for: payloadData)
    }

    // The server signs with JavaScript number formatting, where 50.0 is written as "50".
    static func jsNumber(_ value: Double) -> String {
        if value.truncatingRemainder(dividingBy: 1) == 0, abs(value) < 1e15 {
            return String(Int64(value))
        }
        return "\(value)"
    }
}
