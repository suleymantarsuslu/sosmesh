import XCTest
import Foundation
@testable import SOSMeshContracts

final class GoldenVectorTests: XCTestCase {
    private var goldenVector: [String: Any]!

    override func setUpWithError() throws {
        try super.setUpWithError()
        let url = try XCTUnwrap(
            Self.bundledGoldenURL(),
            "Failed to locate golden-001.json in Bundle.module"
        )
        let data = try Data(contentsOf: url)
        goldenVector = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    /// Resources copied via Package.swift `resources: [.copy("Resources")]` live under the `Resources` subdirectory in the bundle.
    private static func bundledGoldenURL() -> URL? {
        Bundle.module.url(forResource: "golden-001", withExtension: "json", subdirectory: "Resources")
            ?? Bundle.module.url(forResource: "golden-001", withExtension: "json")
    }

    private func inputsAndExpected() throws -> (inputs: [String: Any], expected: [String: Any]) {
        let inputs = try XCTUnwrap(goldenVector["inputs"] as? [String: Any])
        let expected = try XCTUnwrap(goldenVector["expected"] as? [String: Any])
        return (inputs, expected)
    }

    func testGoldenEncryptMatches() throws {
        let (inputs, expected) = try inputsAndExpected()

        let ephemeralPrivateKey = try XCTUnwrap(inputs["ephemeralPrivateKey"] as? String)
        let nonce = try XCTUnwrap(inputs["nonce"] as? String)
        let plaintextString = try XCTUnwrap(inputs["plaintext"] as? String)
        let envelope = try XCTUnwrap(inputs["envelope"] as? [String: Any])

        let ephemeralPrivateKeyData = try XCTUnwrap(Data(base64Encoded: ephemeralPrivateKey))
        let nonceData = try XCTUnwrap(Data(base64Encoded: nonce))
        let plaintext = try XCTUnwrap(plaintextString.data(using: .utf8))

        let config = CryptoConfig(
            keyId: try XCTUnwrap(inputs["keyId"] as? String),
            serverPublicKey: try XCTUnwrap(inputs["serverPublicKey"] as? String),
            serverPrivateKey: try XCTUnwrap(inputs["serverPrivateKey"] as? String)
        )

        let encrypted = try SOSMeshCrypto.encryptDeterministic(
            plaintext,
            envelope: envelope,
            config: config,
            ephemeralPrivateKeyData: ephemeralPrivateKeyData,
            nonceData: nonceData
        )

        let ciphertextData = try XCTUnwrap(Data(base64Encoded: encrypted.ciphertext))
        let ciphertextHex = ciphertextData.map { String(format: "%02x", $0) }.joined()

        XCTAssertEqual(ciphertextHex, expected["ciphertextWithTagHex"] as? String)
        XCTAssertEqual(encrypted.ephemeralPublicKey, expected["ephemeralPublicKey"] as? String)

        print("✓ Swift: Golden encrypt matches (byte-for-byte)")
    }

    func testGoldenDecrypt() throws {
        let (inputs, expected) = try inputsAndExpected()

        let envelope = try XCTUnwrap(inputs["envelope"] as? [String: Any])
        let config = CryptoConfig(
            keyId: try XCTUnwrap(inputs["keyId"] as? String),
            serverPublicKey: try XCTUnwrap(inputs["serverPublicKey"] as? String),
            serverPrivateKey: try XCTUnwrap(inputs["serverPrivateKey"] as? String)
        )

        let encryptedPayload = EncryptedPayload(
            ciphertext: try XCTUnwrap(expected["ciphertextWithTagBase64"] as? String),
            nonce: try XCTUnwrap(inputs["nonce"] as? String),
            ephemeralPublicKey: try XCTUnwrap(expected["ephemeralPublicKey"] as? String),
            keyId: try XCTUnwrap(inputs["keyId"] as? String)
        )

        let decrypted = try SOSMeshCrypto.decryptPayload(encryptedPayload, envelope: envelope, config: config)
        let decryptedStr = try XCTUnwrap(String(data: decrypted, encoding: .utf8))

        XCTAssertTrue(decryptedStr.contains("Golden test vector"))

        print("✓ Swift: Golden decrypt successful")
    }

    func testGoldenTamperedRejected() throws {
        let (inputs, expected) = try inputsAndExpected()

        let envelope = try XCTUnwrap(inputs["envelope"] as? [String: Any])
        let config = CryptoConfig(
            keyId: try XCTUnwrap(inputs["keyId"] as? String),
            serverPublicKey: try XCTUnwrap(inputs["serverPublicKey"] as? String),
            serverPrivateKey: try XCTUnwrap(inputs["serverPrivateKey"] as? String)
        )

        let validPayload = EncryptedPayload(
            ciphertext: try XCTUnwrap(expected["ciphertextWithTagBase64"] as? String),
            nonce: try XCTUnwrap(inputs["nonce"] as? String),
            ephemeralPublicKey: try XCTUnwrap(expected["ephemeralPublicKey"] as? String),
            keyId: try XCTUnwrap(inputs["keyId"] as? String)
        )
        _ = try SOSMeshCrypto.decryptPayload(validPayload, envelope: envelope, config: config)

        var ciphertextData = try XCTUnwrap(Data(base64Encoded: try XCTUnwrap(expected["ciphertextWithTagBase64"] as? String)))
        ciphertextData[ciphertextData.count - 1] ^= 0x01

        let tamperedPayload = EncryptedPayload(
            ciphertext: ciphertextData.base64EncodedString(),
            nonce: try XCTUnwrap(inputs["nonce"] as? String),
            ephemeralPublicKey: try XCTUnwrap(expected["ephemeralPublicKey"] as? String),
            keyId: try XCTUnwrap(inputs["keyId"] as? String)
        )

        XCTAssertThrowsError(try SOSMeshCrypto.decryptPayload(tamperedPayload, envelope: envelope, config: config))

        print("✓ Swift: Tampered golden rejected")
    }
}
