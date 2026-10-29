import XCTest
@testable import SOSMeshContracts
import Foundation

final class CryptoTests: XCTestCase {
    
    let testConfig = CryptoConfig(
        keyId: "dev-test-001",
        serverPublicKey: "BFu/Jxfj3txqvjTtUW7BTYK3iX0E/ysPPwPNk091o1c=",
        serverPrivateKey: "/Y3Ly64i9CwSN722vrc39rW2bf4+mRCByoK1fn/z+9U="
    )
    
    let testEnvelope: [String: Any] = [
        "timestamp": "2026-10-29T20:00:00Z",
        "location": [
            "latitude": 39.9334,
            "longitude": 32.8597,
            "accuracy": 10
        ] as [String : Any],
        "priority": 1
    ]
    
    func testEncryptAndDecrypt() throws {
        let plaintext = "Test SOS message: Need help at coordinates".data(using: .utf8)!
        
        // Encrypt
        let encrypted = try SOSMeshCrypto.encryptPayload(
            plaintext,
            envelope: testEnvelope,
            config: testConfig
        )
        
        // Verify structure
        XCTAssertFalse(encrypted.ciphertext.isEmpty)
        XCTAssertFalse(encrypted.nonce.isEmpty)
        XCTAssertFalse(encrypted.ephemeralPublicKey.isEmpty)
        XCTAssertEqual(encrypted.keyId, "dev-test-001")
        
        // Decrypt
        let decrypted = try SOSMeshCrypto.decryptPayload(
            encrypted,
            envelope: testEnvelope,
            config: testConfig
        )
        
        // Verify roundtrip
        XCTAssertEqual(plaintext, decrypted)
    }
    
    func testFailWithTamperedCiphertext() throws {
        let plaintext = "Test message".data(using: .utf8)!
        let encrypted = try SOSMeshCrypto.encryptPayload(
            plaintext,
            envelope: testEnvelope,
            config: testConfig
        )
        
        // First verify untampered decryption succeeds
        let untampered = try SOSMeshCrypto.decryptPayload(
            encrypted,
            envelope: testEnvelope,
            config: testConfig
        )
        XCTAssertEqual(plaintext, untampered)
        
        // Tamper with ciphertext
        guard var ciphertextData = Data(base64Encoded: encrypted.ciphertext) else {
            XCTFail("Invalid base64")
            return
        }
        ciphertextData[0] ^= 0xFF
        
        let tamperedEncrypted = EncryptedPayload(
            ciphertext: ciphertextData.base64EncodedString(),
            nonce: encrypted.nonce,
            ephemeralPublicKey: encrypted.ephemeralPublicKey,
            keyId: encrypted.keyId
        )
        
        // Should throw
        XCTAssertThrowsError(try SOSMeshCrypto.decryptPayload(
            tamperedEncrypted,
            envelope: testEnvelope,
            config: testConfig
        ))
    }
    
    func testFailWithTamperedTag() throws {
        let plaintext = "Test message".data(using: .utf8)!
        let encrypted = try SOSMeshCrypto.encryptPayload(
            plaintext,
            envelope: testEnvelope,
            config: testConfig
        )
        
        // First verify untampered decryption succeeds
        let untampered = try SOSMeshCrypto.decryptPayload(
            encrypted,
            envelope: testEnvelope,
            config: testConfig
        )
        XCTAssertEqual(plaintext, untampered)
        
        // Tamper with tag (last 16 bytes)
        guard var ciphertextData = Data(base64Encoded: encrypted.ciphertext) else {
            XCTFail("Invalid base64")
            return
        }
        ciphertextData[ciphertextData.count - 1] ^= 0x01
        
        let tamperedEncrypted = EncryptedPayload(
            ciphertext: ciphertextData.base64EncodedString(),
            nonce: encrypted.nonce,
            ephemeralPublicKey: encrypted.ephemeralPublicKey,
            keyId: encrypted.keyId
        )
        
        // Should throw
        XCTAssertThrowsError(try SOSMeshCrypto.decryptPayload(
            tamperedEncrypted,
            envelope: testEnvelope,
            config: testConfig
        ))
    }
    
    func testFailWithTamperedAAD() throws {
        let plaintext = "Test message".data(using: .utf8)!
        let encrypted = try SOSMeshCrypto.encryptPayload(
            plaintext,
            envelope: testEnvelope,
            config: testConfig
        )
        
        // First verify untampered decryption succeeds
        let untampered = try SOSMeshCrypto.decryptPayload(
            encrypted,
            envelope: testEnvelope,
            config: testConfig
        )
        XCTAssertEqual(plaintext, untampered)
        
        // Tamper with AAD
        var tamperedEnvelope = testEnvelope
        tamperedEnvelope["priority"] = 2
        
        // Should throw
        XCTAssertThrowsError(try SOSMeshCrypto.decryptPayload(
            encrypted,
            envelope: tamperedEnvelope,
            config: testConfig
        ))
    }
    
    func testFailWithTamperedNonce() throws {
        let plaintext = "Test message".data(using: .utf8)!
        let encrypted = try SOSMeshCrypto.encryptPayload(
            plaintext,
            envelope: testEnvelope,
            config: testConfig
        )
        
        // First verify untampered decryption succeeds
        let untampered = try SOSMeshCrypto.decryptPayload(
            encrypted,
            envelope: testEnvelope,
            config: testConfig
        )
        XCTAssertEqual(plaintext, untampered)
        
        // Tamper with nonce
        guard var nonceData = Data(base64Encoded: encrypted.nonce) else {
            XCTFail("Invalid base64")
            return
        }
        nonceData[0] ^= 0xFF
        
        let tamperedEncrypted = EncryptedPayload(
            ciphertext: encrypted.ciphertext,
            nonce: nonceData.base64EncodedString(),
            ephemeralPublicKey: encrypted.ephemeralPublicKey,
            keyId: encrypted.keyId
        )
        
        // Should throw
        XCTAssertThrowsError(try SOSMeshCrypto.decryptPayload(
            tamperedEncrypted,
            envelope: testEnvelope,
            config: testConfig
        ))
    }
    
    func testFailWithWrongKeyID() throws {
        let plaintext = "Test message".data(using: .utf8)!
        let encrypted = try SOSMeshCrypto.encryptPayload(
            plaintext,
            envelope: testEnvelope,
            config: testConfig
        )
        
        // Change key ID
        let tamperedEncrypted = EncryptedPayload(
            ciphertext: encrypted.ciphertext,
            nonce: encrypted.nonce,
            ephemeralPublicKey: encrypted.ephemeralPublicKey,
            keyId: "wrong-key-id"
        )
        
        // Should throw CryptoError.keyIdMismatch
        XCTAssertThrowsError(try SOSMeshCrypto.decryptPayload(
            tamperedEncrypted,
            envelope: testEnvelope,
            config: testConfig
        )) { error in
            XCTAssertTrue(error is CryptoError)
            if case CryptoError.keyIdMismatch = error {
                // Expected
            } else {
                XCTFail("Expected keyIdMismatch error")
            }
        }
    }
    
    func testKeyStorageInterface() throws {
        let storage = InMemoryKeyStorage()
        let testKey = Data(count: 32)
        
        // Store
        try storage.storePrivateKey(keyId: "test-001", privateKey: testKey)
        
        // Retrieve
        let retrieved = try storage.getPrivateKey(keyId: "test-001")
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(testKey, retrieved)
        
        // Delete
        try storage.deletePrivateKey(keyId: "test-001")
        let deleted = try storage.getPrivateKey(keyId: "test-001")
        XCTAssertNil(deleted)
    }
}
