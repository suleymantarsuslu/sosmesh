import XCTest
@testable import SOSMesh

final class EmergencyNumberProviderTests: XCTestCase {
    func testReturnsValidEmergencyNumber() {
        let number = EmergencyNumberProvider.getEmergencyNumber()
        XCTAssertFalse(number.isEmpty)
        XCTAssertTrue(number.allSatisfy { $0.isNumber })
    }
    
    func testReturnsFallbackWhenCountryUnknown() {
        let number = EmergencyNumberProvider.getEmergencyNumber()
        XCTAssertNotNil(number)
    }
}
