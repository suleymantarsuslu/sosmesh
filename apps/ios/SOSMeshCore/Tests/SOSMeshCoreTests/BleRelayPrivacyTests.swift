import XCTest
@testable import SOSMeshCore

/// Ensures relay/BLE transport layer never decrypts SOS payloads or logs plaintext (ADIM red line).
final class BleRelayPrivacyTests: XCTestCase {
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

    func testCoreBleSourcesDoNotDecryptOrLogPlaintext() throws {
        let coreBleDir = URL(fileURLWithPath: sourceRoot())
            .appendingPathComponent("apps/ios/CoreBLE")
        let files = try FileManager.default.contentsOfDirectory(at: coreBleDir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "swift" }
        XCTAssertFalse(files.isEmpty, "CoreBLE Swift sources must exist")

        let forbiddenPatterns = [
            "decrypt",
            "SOSMeshCrypto",
            "NSLog(",
            "print(",
            "os_log(",
            "Logger(",
        ]
        for file in files {
            let text = try String(contentsOf: file, encoding: .utf8)
            for pattern in forbiddenPatterns {
                XCTAssertFalse(
                    text.localizedCaseInsensitiveContains(pattern),
                    "\(file.lastPathComponent) must not contain \(pattern)"
                )
            }
        }
    }

    func testRelayRoleSelectionDoesNotRequireCrypto() {
        let selector = BleRoleSelector()
        let relay = selector.resolve(preferredRole: .relay, relayToggleOn: true, hasPendingLocalSos: false)
        XCTAssertEqual(relay.role, .relay)
        XCTAssertTrue(relay.advertise)
    }
}
