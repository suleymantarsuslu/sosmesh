import XCTest
@testable import SOSMesh

final class SosNotificationTests: XCTestCase {
    
    @MainActor
    func testTrackPendingSosAddsToSet() async {
        let manager = SosNotificationManager.shared
        let sosId = "test-sos-123"
        
        manager.trackPendingSos(sosId: sosId)
        
        XCTAssertTrue(manager.pendingSosIds.contains(sosId))
    }
    
    @MainActor
    func testNotifyServerAcceptedRemovesPendingSos() async {
        let manager = SosNotificationManager.shared
        let sosId = "test-sos-456"
        
        manager.trackPendingSos(sosId: sosId)
        XCTAssertTrue(manager.pendingSosIds.contains(sosId))
        
        manager.notifyServerAccepted(sosId: sosId)
        
        XCTAssertFalse(manager.pendingSosIds.contains(sosId))
    }
    
    @MainActor
    func testNotifyServerAcceptedIgnoresUnknownSos() async {
        let manager = SosNotificationManager.shared
        let trackedId = "tracked-sos"
        let unknownId = "unknown-sos"
        
        manager.trackPendingSos(sosId: trackedId)
        let countBefore = manager.pendingSosIds.count
        
        manager.notifyServerAccepted(sosId: unknownId)
        
        XCTAssertEqual(manager.pendingSosIds.count, countBefore)
        XCTAssertTrue(manager.pendingSosIds.contains(trackedId))
    }
}
