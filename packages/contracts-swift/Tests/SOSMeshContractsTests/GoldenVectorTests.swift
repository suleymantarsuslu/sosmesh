import XCTest
import Foundation
@testable import SOSMeshContracts

final class GoldenVectorTests: XCTestCase {
    let goldenVector: [String: Any] = {
        guard let url = Bundle.module.url(forResource: "golden-001", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            fatalError("Failed to load golden-001.json")
        }
        return json
    }()
    
    func testGoldenEncryptMatches() throws {
        let inputs = goldenVector["inputs"] as! [String: Any]
        let expected = goldenVector["expected"] as! [String: Any]
        
        let ephemeralPrivateKeyData = Data(base64Encoded: inputs["ephemeralPrivateKey"] as! String)!
        let nonceData = Data(base64Encoded: inputs["nonce"] as! String)!
        let plaintext = (inputs["plaintext"] as! String).data(using: .utf8)!
        let envelope = inputs["envelope"] as! [String: Any]
        
        let config = CryptoConfig(
            keyId: inputs["keyId"] as! String,
            serverPublicKey: inputs["serverPublicKey"] as! String,
            serverPrivateKey: inputs["serverPrivateKey"] as! String
        )
        
        // Encrypt with deterministic inputs
        let encrypted = try SOSMeshCrypto.encryptDeterministic(
            plaintext,
            envelope: envelope,
            config: config,
            ephemeralPrivateKeyData: ephemeralPrivateKeyData,
            nonceData: nonceData
        )
        
        // Convert to hex
        let ciphertextData = Data(base64Encoded: encrypted.ciphertext)!
        let ciphertextHex = ciphertextData.map { String(format: "%02x", $0) }.joined()
        
        // Assert byte-for-byte match
        XCTAssertEqual(ciphertextHex, expected["ciphertextWithTagHex"] as! String)
        XCTAssertEqual(encrypted.ephemeralPublicKey, expected["ephemeralPublicKey"] as! String)
        
        print("✓ Swift: Golden encrypt matches (byte-for-byte)")
    }
    
    func testGoldenDecrypt() throws {
        let inputs = goldenVector["inputs"] as! [String: Any]
        let expected = goldenVector["expected"] as! [String: Any]
        
        let envelope = inputs["envelope"] as! [String: Any]
        let config = CryptoConfig(
            keyId: inputs["keyId"] as! String,
            serverPublicKey: inputs["serverPublicKey"] as! String,
            serverPrivateKey: inputs["serverPrivateKey"] as! String
        )
        
        let encryptedPayload = EncryptedPayload(
            ciphertext: expected["ciphertextWithTagBase64"] as! String,
            nonce: inputs["nonce"] as! String,
            ephemeralPublicKey: expected["ephemeralPublicKey"] as! String,
            keyId: inputs["keyId"] as! String
        )
        
        // Decrypt golden vector
        let decrypted = try SOSMeshCrypto.decryptPayload(encryptedPayload, envelope: envelope, config: config)
        let decryptedStr = String(data: decrypted, encoding: .utf8)!
        
        // Should contain expected text
        XCTAssertTrue(decryptedStr.contains("Golden test vector"))
        
        print("✓ Swift: Golden decrypt successful")
    }
    
    func testGoldenTamperedRejected() throws {
        let inputs = goldenVector["inputs"] as! [String: Any]
        let expected = goldenVector["expected"] as! [String: Any]
        
        let envelope = inputs["envelope"] as! [String: Any]
        let config = CryptoConfig(
            keyId: inputs["keyId"] as! String,
            serverPublicKey: inputs["serverPublicKey"] as! String,
            serverPrivateKey: inputs["serverPrivateKey"] as! String
        )
        
        // First verify unmodified decrypts successfully
        let validPayload = EncryptedPayload(
            ciphertext: expected["ciphertextWithTagBase64"] as! String,
            nonce: inputs["nonce"] as! String,
            ephemeralPublicKey: expected["ephemeralPublicKey"] as! String,
            keyId: inputs["keyId"] as! String
        )
        _ = try SOSMeshCrypto.decryptPayload(validPayload, envelope: envelope, config: config)
        
        // Now tamper: flip last byte of tag
        var ciphertextData = Data(base64Encoded: expected["ciphertextWithTagBase64"] as! String)!
        ciphertextData[ciphertextData.count - 1] ^= 0x01
        
        let tamperedPayload = EncryptedPayload(
            ciphertext: ciphertextData.base64EncodedString(),
            nonce: inputs["nonce"] as! String,
            ephemeralPublicKey: expected["ephemeralPublicKey"] as! String,
            keyId: inputs["keyId"] as! String
        )
        
        // Should throw
        XCTAssertThrowsError(try SOSMeshCrypto.decryptPayload(tamperedPayload, envelope: envelope, config: config))
        
        print("✓ Swift: Tampered golden rejected")
    }
}
