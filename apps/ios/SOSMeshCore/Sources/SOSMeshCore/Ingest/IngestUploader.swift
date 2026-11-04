import Foundation

public struct IngestConfig {
    public let baseURL: String
    public let receiptVerifyPublicKeySpkiBase64: String
    public let relayIdHex: String
    public let hopCount: Int
    public let ttlSeconds: Int
    
    public init(
        baseURL: String,
        receiptVerifyPublicKeySpkiBase64: String,
        relayIdHex: String,
        hopCount: Int = 1,
        ttlSeconds: Int = 86400
    ) {
        self.baseURL = baseURL
        self.receiptVerifyPublicKeySpkiBase64 = receiptVerifyPublicKeySpkiBase64
        self.relayIdHex = relayIdHex
        self.hopCount = hopCount
        self.ttlSeconds = ttlSeconds
    }
    
    private static let installRelayIdDefaultsKey = "sosmesh.ingest.installRelayIdHex"

    /// 64 lowercase hex chars (32 random bytes), stable per install; not derived from device ids.
    /// The ingest API requires /^[a-f0-9]{64}$/ for relayId.
    static func installRelayIdHex(defaults: UserDefaults = .standard) -> String {
        if let existing = defaults.string(forKey: installRelayIdDefaultsKey),
           existing.count == 64,
           existing.allSatisfy({ ("0"..."9").contains($0) || ("a"..."f").contains($0) }) {
            return existing
        }
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        if status != errSecSuccess {
            for i in bytes.indices { bytes[i] = UInt8.random(in: 0...255) }
        }
        let hex = bytes.map { String(format: "%02x", $0) }.joined()
        defaults.set(hex, forKey: installRelayIdDefaultsKey)
        return hex
    }

    public static func production(deviceId: String) -> IngestConfig {
        #if DEBUG
        return IngestConfig(
            baseURL: "http://localhost:3001",
            receiptVerifyPublicKeySpkiBase64: "",
            relayIdHex: installRelayIdHex()
        )
        #else
        return IngestConfig(
            baseURL: "https://sosmesh.antiosoft.com",
            receiptVerifyPublicKeySpkiBase64: "MCowBQYDK2VwAyEAJgWsM1ZMJK9D9uPkDS/08DL/sOHrBlcCS/ETcKQ2OEs=",
            relayIdHex: installRelayIdHex()
        )
        #endif
    }
}

public enum IngestUploadResult {
    case success(ServerAcceptedReceipt)
    case noNetwork
    case invalidReceipt
    case httpError(Int, String, retryAfterSeconds: Int?)
    case error(String)
}

public final class IngestUploader {
    private let config: IngestConfig
    private let client: IngestClientPort
    private let verifier: ServerReceiptVerifier
    
    public init(
        config: IngestConfig,
        client: IngestClientPort? = nil
    ) {
        self.config = config
        self.client = client ?? IngestClient(baseURL: config.baseURL)
        self.verifier = ServerReceiptVerifier(publicKeySpkiBase64: config.receiptVerifyPublicKeySpkiBase64)
    }
    
    public func upload(
        sosId: String,
        digest: String,
        encryptedBlobBase64: String,
        sosMessageJson: [String: Any]
    ) async -> IngestUploadResult {
        await upload(sosId: sosId, digest: digest, encryptedBlobBase64: encryptedBlobBase64, sosMessageJson: sosMessageJson, hopCount: config.hopCount)
    }

    /// `hopCount` = L1 hopCount + 1 for carried copies, 0 for the device's own SOS (mesh v2 §9).
    public func upload(
        sosId: String,
        digest: String,
        encryptedBlobBase64: String,
        sosMessageJson: [String: Any],
        hopCount: Int
    ) async -> IngestUploadResult {
        let decoder = JSONDecoder()
        guard let decodedBlob = Data(base64Encoded: encryptedBlobBase64) else {
            return .error("Invalid base64 blob")
        }
        
        let packetHash = sha256Hex(decodedBlob)
        let now = ISO8601DateFormatter().string(from: Date())
        
        let sosMessageCodable = sosMessageJson.mapValues { AnyCodable($0) }
        
        let request = IngestRequest(
            sosMessage: sosMessageCodable,
            relayInfo: IngestRelayInfo(
                relayId: config.relayIdHex,
                hopCount: max(0, min(32, hopCount)),
                relayTimestamp: now
            ),
            transport: IngestTransport(
                ttlSeconds: config.ttlSeconds,
                packetHash: packetHash
            )
        )
        
        let result = await client.upload(request: request)
        
        switch result {
        case .success(let receipt):
            let valid = verifier.verify(
                receipt: receipt,
                expectedMessageId: sosId,
                expectedPacketHash: packetHash
            )
            return valid ? .success(receipt) : .invalidReceipt
            
        case .noNetwork:
            return .noNetwork

        case .invalidReceipt:
            return .invalidReceipt
            
        case .httpError(let code, let message, let retryAfterSeconds):
            return .httpError(code, message, retryAfterSeconds: retryAfterSeconds)
            
        case .decodingError(let error):
            return .error(error.localizedDescription)
        }
    }
    
    private func sha256Hex(_ data: Data) -> String {
        var hasher = SHA256Hasher()
        hasher.update(data)
        let digest = hasher.finalize()
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

private struct SHA256Hasher {
    private var context = CC_SHA256_CTX()
    
    init() {
        CC_SHA256_Init(&context)
    }
    
    mutating func update(_ data: Data) {
        data.withUnsafeBytes { bytes in
            _ = CC_SHA256_Update(&context, bytes.baseAddress, CC_LONG(data.count))
        }
    }
    
    mutating func finalize() -> [UInt8] {
        var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        CC_SHA256_Final(&digest, &context)
        return digest
    }
}

import CommonCrypto
