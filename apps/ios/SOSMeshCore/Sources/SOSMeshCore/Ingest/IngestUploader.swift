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
    
    public static func production(deviceId: String) -> IngestConfig {
        #if DEBUG
        return IngestConfig(
            baseURL: "http://localhost:3001",
            receiptVerifyPublicKeySpkiBase64: "",
            relayIdHex: deviceId
        )
        #else
        return IngestConfig(
            baseURL: "https://sosmesh.antiosoft.com",
            receiptVerifyPublicKeySpkiBase64: "MCowBQYDK2VwAyEAJgWsM1ZMJK9D9uPkDS/08DL/sOHrBlcCS/ETcKQ2OEs=",
            relayIdHex: deviceId
        )
        #endif
    }
}

public enum IngestUploadResult {
    case success
    case noNetwork
    case invalidReceipt
    case httpError(Int, String)
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
                hopCount: config.hopCount,
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
            return valid ? .success : .invalidReceipt
            
        case .noNetwork:
            return .noNetwork

        case .invalidReceipt:
            return .invalidReceipt
            
        case .httpError(let code, let message):
            return .httpError(code, message)
            
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
