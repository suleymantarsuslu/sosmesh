import XCTest
@testable import SOSMesh

final class EmergencyCall112LinkTests: XCTestCase {
    func testEmergencyDialURLIs112() {
        XCTAssertEqual(EmergencyCall112Link.url.scheme, "tel")
        XCTAssertEqual(EmergencyCall112Link.url.absoluteString, "tel:112")
    }
}
