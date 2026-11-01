import XCTest
@testable import SOSMeshCore
import SOSMeshContracts

final class BleRoleSelectorTests: XCTestCase {
    func testPendingSosForcesSenderScanOnly() {
        let selector = BleRoleSelector()
        let result = selector.resolve(preferredRole: .relay, relayToggleOn: true, hasPendingLocalSos: true)
        XCTAssertEqual(result.role, .sender)
        XCTAssertTrue(result.scan)
        XCTAssertFalse(result.advertise)
        XCTAssertEqual(result.reason, .sosPendingRequiresSender)
    }

    func testRelayToggleEnablesAdvertise() {
        let selector = BleRoleSelector()
        let result = selector.resolve(preferredRole: .relay, relayToggleOn: true, hasPendingLocalSos: false)
        XCTAssertTrue(result.advertise)
        XCTAssertTrue(result.scan)
    }
}
