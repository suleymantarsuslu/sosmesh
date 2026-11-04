import XCTest
@testable import SOSMesh

final class EmergencyCall112LinkTests: XCTestCase {
    func testEmergencyDialURLScheme() {
        XCTAssertEqual(EmergencyCall112Link.url.scheme, "tel")
    }
    
    func testEmergencyDialURLContainsNumber() {
        let url = EmergencyCall112Link.url.absoluteString
        XCTAssertTrue(url.hasPrefix("tel:"))
        let numberPart = url.replacingOccurrences(of: "tel:", with: "")
        XCTAssertFalse(numberPart.isEmpty)
    }
}
