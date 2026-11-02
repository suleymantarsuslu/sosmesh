import XCTest
import Foundation
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

    private static func bundledGoldenURL() -> URL? {
        Bundle.module.url(forResource: "golden-001", withExtension: "json", subdirectory: "Resources")
            ?? Bundle.module.url(forResource: "golden-001", withExtension: "json")
    }

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

    func testGolden001BundledBytesMatchMasterVector() throws {
        let bundledURL = try XCTUnwrap(Self.bundledGoldenURL())
        let masterURL = URL(fileURLWithPath: sourceRoot())
            .appendingPathComponent("packages/contracts/crypto-test-vectors/golden-001.json")
        let bundled = try Data(contentsOf: bundledURL)
        let master = try Data(contentsOf: masterURL)
        XCTAssertEqual(bundled, master, "iOS bundled golden-001 must byte-match TypeScript master vector")
    }

    // Crypto AAD canonicalization is owned by SOSMeshContracts (see GoldenVectorTests + TypeScriptCryptoReference there).

    func testGoldenEncryptMatchesContractsPackage() throws {
        let inputs = try XCTUnwrap(goldenVector["inputs"] as? [String: Any])
        let expected = try XCTUnwrap(goldenVector["expected"] as? [String: Any])

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
