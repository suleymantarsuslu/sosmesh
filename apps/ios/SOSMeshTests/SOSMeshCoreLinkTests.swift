import XCTest
@testable import SOSMeshCore

final class SOSMeshCoreSmokeTests: XCTestCase {
    func testBleConstantsMatchAndroidUuid() {
        XCTAssertEqual(BleMeshConstants.serviceUUID, "0000FFF0-0000-1000-8000-00805F9B34FB")
    }
}
