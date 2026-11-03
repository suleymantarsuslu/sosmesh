import XCTest
@testable import SOSMesh

final class SosCryptoConfigurationErrorTests: XCTestCase {
    func testReleaseEncryptionErrorUsesLocalizedMessage() {
        let error = SosCryptoConfigurationError.releaseEncryptionNotConfigured
        let description = error.errorDescription ?? ""
        XCTAssertFalse(description.isEmpty)
        XCTAssertFalse(description.contains("releaseEncryptionNotConfigured"))
    }
}
