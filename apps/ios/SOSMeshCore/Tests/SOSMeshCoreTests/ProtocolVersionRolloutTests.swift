import XCTest
@testable import SOSMeshContracts

final class ProtocolVersionRolloutTests: XCTestCase {
    func testLegacyHelloVersionMismatchIsDetectable() {
        let negotiated = BleProtocol.protocolVersion
        let legacyPeerVersion: UInt8 = 0x99
        XCTAssertNotEqual(legacyPeerVersion, negotiated)
    }

    func testCurrentProtocolVersionIsStableForRollout() {
        XCTAssertEqual(BleProtocol.protocolVersion, 0x01)
    }
}
