import Foundation

/// BLE transfer payload for one opaque, sender-encrypted attachment copy (mesh-v2 §2.5).
/// `SOSATT1\n` + one-line JSON header + `\n` + raw ciphertext. Relays never decrypt it.
public enum BleAttachmentWire {
    public static let maxCiphertextBytes = 300 * 1024
    public static let maxAttachmentsPerSos = 4
    private static let magic = Data("SOSATT1\n".utf8)
    private static let newline = UInt8(ascii: "\n")

    public struct Parsed: Equatable {
        public let sosId: String
        public let attachmentId: String
        public let kind: String
        public let nonce: String
        public let ephemeralPublicKey: String
        public let keyId: String
        public let ciphertext: Data
    }

    public static func isAttachment(_ payload: Data) -> Bool {
        payload.count > magic.count && payload.prefix(magic.count) == magic
    }

    public static func encode(
        sosId: String, attachmentId: String, kind: String,
        nonce: String, ephemeralPublicKey: String, keyId: String, ciphertext: Data
    ) -> Data? {
        let header: [String: String] = [
            "sosId": sosId, "attachmentId": attachmentId, "kind": kind,
            "nonce": nonce, "ephemeralPublicKey": ephemeralPublicKey, "keyId": keyId,
        ]
        guard let json = try? JSONSerialization.data(withJSONObject: header, options: [.sortedKeys]) else { return nil }
        var out = magic
        out.append(json)
        out.append(newline)
        out.append(ciphertext)
        return out
    }

    public static func decode(_ payload: Data) -> Parsed? {
        guard isAttachment(payload) else { return nil }
        let bytes = [UInt8](payload)
        guard let end = (magic.count ..< bytes.count).first(where: { bytes[$0] == newline }) else { return nil }
        let headerData = Data(bytes[magic.count ..< end])
        guard let header = (try? JSONSerialization.jsonObject(with: headerData)) as? [String: String],
              let kind = header["kind"], kind == "image" || kind == "audio",
              let sosId = header["sosId"], !sosId.isEmpty,
              let attachmentId = header["attachmentId"], isSafeId(attachmentId),
              let nonce = header["nonce"], !nonce.isEmpty,
              let ephemeral = header["ephemeralPublicKey"], !ephemeral.isEmpty,
              let keyId = header["keyId"], !keyId.isEmpty else { return nil }
        let ciphertext = Data(bytes[(end + 1)...])
        guard !ciphertext.isEmpty, ciphertext.count <= maxCiphertextBytes else { return nil }
        return Parsed(sosId: sosId, attachmentId: attachmentId, kind: kind, nonce: nonce,
                      ephemeralPublicKey: ephemeral, keyId: keyId, ciphertext: ciphertext)
    }

    /// Engine digest convention: base64 SHA-256 of the transfer payload.
    public static func digestOf(_ payload: Data) -> String {
        BleProtocol.calculateSHA256(payload).base64EncodedString()
    }

    private static func isSafeId(_ id: String) -> Bool {
        guard (1 ... 64).contains(id.count) else { return false }
        return id.unicodeScalars.allSatisfy { ($0.isASCII && ($0.properties.isAlphabetic || ("0" ... "9").contains(Character($0)))) || $0 == "-" || $0 == "_" }
    }
}
