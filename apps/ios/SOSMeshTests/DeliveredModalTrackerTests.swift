import XCTest
@testable import SOSMesh

final class DeliveredModalTrackerTests: XCTestCase {
    var tracker: DeliveredModalTracker!
    var defaults: UserDefaults!
    
    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "test.deliveredmodal")
        defaults.removePersistentDomain(forName: "test.deliveredmodal")
        tracker = DeliveredModalTracker(defaults: defaults)
    }
    
    override func tearDown() {
        defaults.removePersistentDomain(forName: "test.deliveredmodal")
        super.tearDown()
    }
    
    func testShouldShowModalForNewMessage() {
        XCTAssertTrue(tracker.shouldShowModal(for: "sos-1"))
    }
    
    func testShouldNotShowModalAfterMarkedShown() {
        XCTAssertTrue(tracker.shouldShowModal(for: "sos-1"))
        
        tracker.markModalShown(for: "sos-1")
        
        XCTAssertFalse(tracker.shouldShowModal(for: "sos-1"))
    }
    
    func testTracksMultipleMessages() {
        tracker.markModalShown(for: "sos-1")
        
        XCTAssertFalse(tracker.shouldShowModal(for: "sos-1"))
        XCTAssertTrue(tracker.shouldShowModal(for: "sos-2"))
        
        tracker.markModalShown(for: "sos-2")
        
        XCTAssertFalse(tracker.shouldShowModal(for: "sos-1"))
        XCTAssertFalse(tracker.shouldShowModal(for: "sos-2"))
    }
    
    func testPersistsAcrossRestarts() {
        tracker.markModalShown(for: "sos-1")
        XCTAssertFalse(tracker.shouldShowModal(for: "sos-1"))
        
        let newTracker = DeliveredModalTracker(defaults: defaults)
        XCTAssertFalse(newTracker.shouldShowModal(for: "sos-1"))
        XCTAssertTrue(newTracker.shouldShowModal(for: "sos-2"))
    }
}
