import XCTest
@testable import SOSMesh

final class OpenCaseTrackerTests: XCTestCase {
    var tracker: OpenCaseTracker!
    var defaults: UserDefaults!
    
    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "test.opencase")
        defaults.removePersistentDomain(forName: "test.opencase")
        tracker = OpenCaseTracker(defaults: defaults)
    }
    
    override func tearDown() {
        defaults.removePersistentDomain(forName: "test.opencase")
        super.tearDown()
    }
    
    func testOpenCase() {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        
        XCTAssertFalse(tracker.hasOpenCase(nowMs: nowMs))
        
        tracker.openCase(sosId: "test-sos-1", nowMs: nowMs)
        
        XCTAssertTrue(tracker.hasOpenCase(nowMs: nowMs))
        
        let openCase = tracker.currentOpenCase(nowMs: nowMs)
        XCTAssertEqual(openCase?.sosId, "test-sos-1")
    }
    
    func testCaseExpiresAfter24Hours() {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        
        tracker.openCase(sosId: "test-sos-1", nowMs: nowMs)
        XCTAssertTrue(tracker.hasOpenCase(nowMs: nowMs))
        
        let after24HoursMs = nowMs + (24 * 60 * 60 * 1000) + 1000
        XCTAssertFalse(tracker.hasOpenCase(nowMs: after24HoursMs))
    }
    
    func testClearCase() {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        
        tracker.openCase(sosId: "test-sos-1", nowMs: nowMs)
        XCTAssertTrue(tracker.hasOpenCase(nowMs: nowMs))
        
        tracker.clearCase()
        XCTAssertFalse(tracker.hasOpenCase(nowMs: nowMs))
    }
    
    func testPersistsAcrossRestarts() {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        
        tracker.openCase(sosId: "test-sos-1", nowMs: nowMs)
        XCTAssertTrue(tracker.hasOpenCase(nowMs: nowMs))
        
        let newTracker = OpenCaseTracker(defaults: defaults)
        XCTAssertTrue(newTracker.hasOpenCase(nowMs: nowMs))
        
        let openCase = newTracker.currentOpenCase(nowMs: nowMs)
        XCTAssertEqual(openCase?.sosId, "test-sos-1")
    }
}
