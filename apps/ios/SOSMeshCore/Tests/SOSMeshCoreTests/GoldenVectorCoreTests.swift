import XCTest
@testable import SOSMeshCore
import SOSMeshContracts

final class GoldenVectorCoreTests: XCTestCase {
    func sourceRoot() -> String {
        if let envRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] {
            return envRoot
        }
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 {
            url.deleteLastPathComponent()
        }
        return url.path
    }

    let goldenVector: [String: Any] = {
        guard let url = Bundle.module.url(forResource: "golden-001", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            fatalError("Failed to load golden-001.json")
        }
        return json
    }()

    func testGolden001BundledBytesMatchMasterVector() throws {
        guard let bundledURL = Bundle.module.url(forResource: "golden-001", withExtension: "json") else {
            XCTFail("Bundled golden-001.json missing")
            return
        }
        let masterURL = URL(fileURLWithPath: sourceRoot())
            .appendingPathComponent("packages/contracts/crypto-test-vectors/golden-001.json")
        let bundled = try Data(contentsOf: bundledURL)
        let master = try Data(contentsOf: masterURL)
        XCTAssertEqual(bundled, master, "iOS bundled golden-001 must byte-match TypeScript master vector")
    }

    func testGoldenEncryptMatchesContractsPackage() throws {
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

        let encrypted = try SOSMeshCrypto.encryptDeterministic(
            plaintext,
            envelope: envelope,
            config: config,
            ephemeralPrivateKeyData: ephemeralPrivateKeyData,
            nonceData: nonceData
        )

        let ciphertextData = Data(base64Encoded: encrypted.ciphertext)!
        let ciphertextHex = ciphertextData.map { String(format: "%02x", $0) }.joined()

        XCTAssertEqual(ciphertextHex, expected["ciphertextWithTagHex"] as! String)
        XCTAssertEqual(encrypted.ephemeralPublicKey, expected["ephemeralPublicKey"] as! String)
    }

    func testMessageEnvelopeBuilderRejectsBadTimestamp() {
        let builder = MessageEnvelopeBuilder()
        XCTAssertThrowsError(
            try builder.buildWireMessage(
                sosId: "id",
                timestamp: "not-iso",
                location: nil,
                encryptedPayloadBase64: "YQ=="
            )
        )
    }
}
