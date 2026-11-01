import XCTest
@testable import SOSMeshCore

final class WatchConnectivitySendPlannerTests: XCTestCase {
    func testSessionInactiveBlocksImmediateSend() {
        let snap = WatchConnectivitySendPlanner.snapshot(
            isPaired: true,
            sessionActivated: false,
            isReachable: true,
            isCompanionAppInstalled: true,
            watchLocked: false,
            lowPowerMode: false
        )
        XCTAssertEqual(snap.phase, .sessionInactive)
        XCTAssertEqual(snap.sendMode, .none)
        XCTAssertFalse(WatchConnectivitySendPlanner.isPhoneReachableForQueue(snapshot: snap))
    }

    func testNotPairedBlocksSendAndShowsMeshDisclaimer() {
        let snap = WatchConnectivitySendPlanner.snapshot(
            isPaired: false,
            sessionActivated: false,
            isReachable: false,
            isCompanionAppInstalled: false,
            watchLocked: false,
            lowPowerMode: false
        )
        XCTAssertEqual(snap.phase, .notPaired)
        XCTAssertEqual(snap.sendMode, .none)
        XCTAssertTrue(snap.userDetailTr.contains("mesh garantisi"))
    }

    func testReachableUsesSendMessage() {
        let snap = WatchConnectivitySendPlanner.snapshot(
            isPaired: true,
            sessionActivated: true,
            isReachable: true,
            isCompanionAppInstalled: true,
            watchLocked: false,
            lowPowerMode: false
        )
        XCTAssertEqual(snap.sendMode, .sendMessage)
        XCTAssertTrue(WatchConnectivitySendPlanner.isPhoneReachableForQueue(snapshot: snap))
    }

    func testLowPowerUsesBackgroundQueue() {
        let snap = WatchConnectivitySendPlanner.snapshot(
            isPaired: true,
            sessionActivated: true,
            isReachable: true,
            isCompanionAppInstalled: true,
            watchLocked: false,
            lowPowerMode: true
        )
        XCTAssertEqual(snap.sendMode, .transferUserInfo)
        XCTAssertFalse(WatchConnectivitySendPlanner.isPhoneReachableForQueue(snapshot: snap))
    }
}
