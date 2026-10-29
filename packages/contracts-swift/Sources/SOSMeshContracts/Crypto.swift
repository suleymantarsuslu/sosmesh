import Foundation
import Crypto

#if canImport(Security)
import Security
#endif

/**
 * ADIM 09: X25519 + HKDF-SHA256 + ChaCha20-Poly1305 with AAD
 * 
 * Crypto implementation using swift-crypto for iOS/macOS.
 * Compatible with TypeScript (@noble libraries) and Kotlin (BouncyCastle) implementations.
 */

public struct EncryptedPayload: Codable {
    public let ciphertext: String // base64: encrypted data || 16-byte Poly1305 tag
    public let nonce: String // base64: 12-byte nonce
    public let ephemeralPublicKey: String // base64: 32-byte X25519 public key
    public let keyId: String
    
    public init(ciphertext: String, nonce: String, ephemeralPublicKey: String, keyId: String) {
        self.ciphertext = ciphertext
        self.nonce = nonce
        self.ephemeralPublicKey = ephemeralPublicKey
        self.keyId = keyId
    }
}

public struct CryptoConfig {
    public let keyId: String
    public let serverPublicKey: String // base64
    public let serverPrivateKey: String? // base64, only for decryption
    
    public init(keyId: String, serverPublicKey: String, serverPrivateKey: String? = nil) {
        self.keyId = keyId
        self.serverPublicKey = serverPublicKey
        self.serverPrivateKey = serverPrivateKey
    }
}

public enum CryptoError: Error {
    case invalidKey
    case invalidNonce
    case encryptionFailed
    case decryptionFailed
    case keyIdMismatch
    case missingPrivateKey
    case invalidInput(String)
}

public struct SOSMeshCrypto {
    private static let protocolVersion = "v1"
    private static let nonceSize = 12 // 96 bits for IETF ChaCha20
    private static let tagSize = 16 // 128 bits Poly1305
    
    /**
     * Encrypt payload with server's pinned public key.
     *
     * - Parameters:
     *   - payload: Plaintext data to encrypt
     *   - envelope: Envelope metadata to bind as AAD
     *   - config: Crypto configuration with server public key
     * - Returns: Encrypted payload with ephemeral public key, nonce, and ciphertext+tag
     * - Throws: CryptoError if encryption fails
     */
    public static func encryptPayload(
        _ payload: Data,
        envelope: [String: Any],
        config: CryptoConfig
    ) throws -> EncryptedPayload {
        // Generate ephemeral X25519 keypair
        let ephemeralPrivateKey = Curve25519.KeyAgreement.PrivateKey()
        let ephemeralPublicKey = ephemeralPrivateKey.publicKey
        
        // Parse server public key
        guard let serverPublicKeyData = Data(base64Encoded: config.serverPublicKey),
              serverPublicKeyData.count == 32 else {
            throw CryptoError.invalidKey
        }
        
        let serverPublicKey = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: serverPublicKeyData)
        
        // Perform X25519 ECDH
        let sharedSecret = try ephemeralPrivateKey.sharedSecretFromKeyAgreement(with: serverPublicKey)
        
        // Generate random nonce
        var nonceBytes = Data(count: nonceSize)
        
        #if canImport(Security)
        let result = nonceBytes.withUnsafeMutableBytes {
            SecRandomCopyBytes(kSecRandomDefault, nonceSize, $0.baseAddress!)
        }
        guard result == errSecSuccess else {
            throw CryptoError.encryptionFailed
        }
        #else
        // Linux fallback: use SystemRandomNumberGenerator
        var rng = SystemRandomNumberGenerator()
        var bytes = [UInt8](repeating: 0, count: nonceSize)
        for i in 0..<nonceSize {
            bytes[i] = UInt8.random(in: 0...255, using: &rng)
        }
        nonceBytes = Data(bytes)
        #endif
        
        // Derive encryption key using HKDF-SHA256
        let encryptionKey = try deriveEncryptionKey(
            sharedSecret: sharedSecret,
            salt: nonceBytes,
            keyId: config.keyId
        )
        
        // Create AAD (Associated Authenticated Data)
        let aad = try createAAD(envelope: envelope, keyId: config.keyId)
        
        // Encrypt with ChaCha20-Poly1305
        let sealedBox = try ChaChaPoly.seal(
            payload,
            using: SymmetricKey(data: encryptionKey),
            nonce: ChaChaPoly.Nonce(data: nonceBytes),
            authenticating: aad
        )
        
        // Combine ciphertext + tag
        let ciphertextWithTag = sealedBox.ciphertext + sealedBox.tag
        
        return EncryptedPayload(
            ciphertext: ciphertextWithTag.base64EncodedString(),
            nonce: nonceBytes.base64EncodedString(),
            ephemeralPublicKey: ephemeralPublicKey.rawRepresentation.base64EncodedString(),
            keyId: config.keyId
        )
    }
    
    /**
     * Decrypt payload with server's private key.
     *
     * - Parameters:
     *   - encrypted: Encrypted payload with ephemeral public key, nonce, and ciphertext+tag
     *   - envelope: Envelope metadata to verify AAD
     *   - config: Crypto configuration with server private key
     * - Returns: Decrypted plaintext data
     * - Throws: CryptoError if decryption fails (wrong key, tampered data, etc.)
     */
    public static func decryptPayload(
        _ encrypted: EncryptedPayload,
        envelope: [String: Any],
        config: CryptoConfig
    ) throws -> Data {
        guard encrypted.keyId == config.keyId else {
            throw CryptoError.keyIdMismatch
        }
        
        guard let serverPrivateKeyBase64 = config.serverPrivateKey else {
            throw CryptoError.missingPrivateKey
        }
        
        // Parse keys
        guard let serverPrivateKeyData = Data(base64Encoded: serverPrivateKeyBase64),
              serverPrivateKeyData.count == 32 else {
            throw CryptoError.invalidKey
        }
        
        let serverPrivateKey = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: serverPrivateKeyData)
        
        guard let ephemeralPublicKeyData = Data(base64Encoded: encrypted.ephemeralPublicKey),
              ephemeralPublicKeyData.count == 32 else {
            throw CryptoError.invalidKey
        }
        
        let ephemeralPublicKey = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: ephemeralPublicKeyData)
        
        // Perform X25519 ECDH
        let sharedSecret = try serverPrivateKey.sharedSecretFromKeyAgreement(with: ephemeralPublicKey)
        
        // Parse nonce
        guard let nonceData = Data(base64Encoded: encrypted.nonce),
              nonceData.count == nonceSize else {
            throw CryptoError.invalidNonce
        }
        
        // Derive encryption key
        let encryptionKey = try deriveEncryptionKey(
            sharedSecret: sharedSecret,
            salt: nonceData,
            keyId: config.keyId
        )
        
        // Create AAD
        let aad = try createAAD(envelope: envelope, keyId: config.keyId)
        
        // Parse ciphertext + tag
        guard let ciphertextWithTag = Data(base64Encoded: encrypted.ciphertext),
              ciphertextWithTag.count >= tagSize else {
            throw CryptoError.decryptionFailed
        }
        
        let ciphertext = ciphertextWithTag.prefix(ciphertextWithTag.count - tagSize)
        let tag = ciphertextWithTag.suffix(tagSize)
        
        // Decrypt with ChaCha20-Poly1305
        do {
            let sealedBox = try ChaChaPoly.SealedBox(
                nonce: ChaChaPoly.Nonce(data: nonceData),
                ciphertext: ciphertext,
                tag: tag
            )
            
            let plaintext = try ChaChaPoly.open(
                sealedBox,
                using: SymmetricKey(data: encryptionKey),
                authenticating: aad
            )
            
            return plaintext
        } catch {
            throw CryptoError.decryptionFailed
        }
    }
    
    /**
     * Derive 32-byte encryption key using HKDF-SHA256.
     */
    private static func deriveEncryptionKey(
        sharedSecret: SharedSecret,
        salt: Data,
        keyId: String
    ) throws -> Data {
        let info = "SOSMesh-\(protocolVersion)-\(keyId)-encryption".data(using: .utf8)!
        
        let derivedKey = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: sharedSecret),
            salt: salt,
            info: info,
            outputByteCount: 32
        )
        
        return derivedKey.withUnsafeBytes { Data($0) }
    }
    
    /**
     * Create canonical AAD (Associated Authenticated Data) for authenticated encryption.
     * AAD binds envelope metadata to the ciphertext.
     */
    private static func createAAD(envelope: [String: Any], keyId: String) throws -> Data {
        let aadObject: [String: Any] = [
            "envelope": sortKeys(envelope),
            "keyId": keyId,
            "protocol": protocolVersion
        ]
        
        let canonicalJSON = try toCanonicalJSON(aadObject)
        return canonicalJSON.data(using: .utf8)!
    }
    
    /**
     * Recursively sort dictionary keys for canonical JSON serialization.
     */
    private static func sortKeys(_ obj: Any) -> Any {
        if let dict = obj as? [String: Any] {
            var sorted = [String: Any]()
            for key in dict.keys.sorted() {
                sorted[key] = sortKeys(dict[key]!)
            }
            return sorted
        } else if let array = obj as? [Any] {
            return array.map { sortKeys($0) }
        } else {
            return obj
        }
    }
    
    /**
     * Convert object to canonical JSON string.
     */
    private static func toCanonicalJSON(_ obj: Any) throws -> String {
        if let dict = obj as? [String: Any] {
            let sorted = dict.sorted { $0.key < $1.key }
            let items = try sorted.map { key, value in
                "\"\(key)\":\(try toCanonicalJSON(value))"
            }
            return "{\(items.joined(separator: ","))}"
        } else if let array = obj as? [Any] {
            let items = try array.map { try toCanonicalJSON($0) }
            return "[\(items.joined(separator: ","))]"
        } else if let string = obj as? String {
            return "\"\(string)\""
        } else if let boolValue = obj as? Bool {
            return boolValue ? "true" : "false"
        } else if let number = obj as? Int {
            return "\(number)"
        } else if let number = obj as? Double {
            return "\(number)"
        } else if let number = obj as? NSNumber {
            // NSNumber fallback (mainly for Darwin)
            return "\(number)"
        } else {
            return "null"
        }
    }
}

/**
 * Protocol for platform-specific secure key storage.
 *
 * On iOS: Backed by iOS Keychain
 * On macOS: Backed by macOS Keychain
 */
public protocol KeyStorage {
    func storePrivateKey(keyId: String, privateKey: Data) throws
    func getPrivateKey(keyId: String) throws -> Data?
    func deletePrivateKey(keyId: String) throws
}

/**
 * In-memory key storage for testing.
 * NOT SECURE FOR PRODUCTION USE.
 */
public class InMemoryKeyStorage: KeyStorage {
    private var storage: [String: Data] = [:]
    
    public init() {}
    
    public func storePrivateKey(keyId: String, privateKey: Data) throws {
        storage[keyId] = privateKey
    }
    
    public func getPrivateKey(keyId: String) throws -> Data? {
        return storage[keyId]
    }
    
    public func deletePrivateKey(keyId: String) throws {
        storage.removeValue(forKey: keyId)
    }
}

/**
 * iOS/macOS Keychain adapter.
 * MARKED AS NOT_TESTED: Requires real iOS/macOS device with Keychain access.
 * Implementation placeholder - actual Keychain integration requires:
 * - SecItemAdd / SecItemCopyMatching / SecItemDelete
 * - Proper access control and encryption attributes
 * - Biometric authentication support
 */
public class KeychainAdapter: KeyStorage {
    public init() {
        print("WARNING: KeychainAdapter is NOT_TESTED and requires real device with Keychain")
    }
    
    public func storePrivateKey(keyId: String, privateKey: Data) throws {
        fatalError("NOT_TESTED: Requires iOS/macOS Keychain on real device")
    }
    
    public func getPrivateKey(keyId: String) throws -> Data? {
        fatalError("NOT_TESTED: Requires iOS/macOS Keychain on real device")
    }
    
    public func deletePrivateKey(keyId: String) throws {
        fatalError("NOT_TESTED: Requires iOS/macOS Keychain on real device")
    }
}
