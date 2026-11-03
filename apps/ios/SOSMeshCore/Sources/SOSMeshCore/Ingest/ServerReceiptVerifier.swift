import Foundation
import CryptoKit

public final class ServerReceiptVerifier {
    private let publicKeySpkiBase64: String
    
    public init(publicKeySpkiBase64: String) {
        self.publicKeySpkiBase64 = publicKeySpkiBase64
    }
    
    public func verify(
        receipt: ServerAcceptedReceipt,
        expectedMessageId: String,
        expectedPacketHash: String
    ) -> Bool {
        guard receipt.ackType == "SERVER_ACCEPTED" else {
            return false
        }
        
        guard receipt.messageId == expectedMessageId,
              receipt.packetHash == expectedPacketHash else {
            return false
        }
        
        guard let publicKey = loadPublicKey() else {
            return false
        }
        
        let payload = "SERVER_ACCEPTED|\(receipt.messageId)|\(receipt.packetHash)|\(receipt.timestamp)"
        guard let payloadData = payload.data(using: .utf8),
              let signatureData = Data(base64Encoded: receipt.signature) else {
            return false
        }
        
        do {
            return try publicKey.isValidSignature(signatureData, for: payloadData)
        } catch {
            return false
        }
    }
    
    private func loadPublicKey() -> Curve25519.Signing.PublicKey? {
        guard !publicKeySpkiBase64.isEmpty,
              let spkiData = Data(base64Encoded: publicKeySpkiBase64) else {
            return nil
        }
        
        let ed25519Header: [UInt8] = [
            0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65,
            0x70, 0x03, 0x21, 0x00
        ]
        
        guard spkiData.count == ed25519Header.count + 32 else {
            return nil
        }
        
        let headerData = spkiData.prefix(ed25519Header.count)
        guard headerData.elementsEqual(ed25519Header) else {
            return nil
        }
        
        let rawKey = spkiData.suffix(32)
        
        return try? Curve25519.Signing.PublicKey(rawRepresentation: rawKey)
    }
}
