import XCTest
@testable import SOSMeshCore

final class WatchStateSyncEngineTests: XCTestCase {
    func testUnreachableNeverShowsFalseSuccess() {
        let wire = WatchSosCreateWire(messageId: "a", nonce: "b", sosType: "diger", createdAtMs: 0)
        let entry = WatchOutboundEntry(
            messageId: "a",
            nonce: "b",
            wire: wire,
            status: WatchOutboundWireStatus.phoneUnreachable,
            attemptCount: 0,
            nextRetryAtMs: 0,
            lastError: "phone_not_reachable",
            updatedAtMs: 0
        )
        let display = WatchStateSyncEngine.fromOutbound(
            entry: entry,
            lastAck: nil,
            watchConnectedToPhone: false,
            nowMs: 100
        )
        XCTAssertEqual(display.phase, .phoneUnreachable)
        XCTAssertFalse(display.showsFalseSuccess)
        XCTAssertFalse(display.headlineTr.contains("gönderildi"))
    }

    func testPhoneQueuedCopyDoesNotClaimServer() {
        let wire = WatchSosCreateWire(messageId: "c", nonce: "d", sosType: "diger", createdAtMs: 0)
        let entry = WatchOutboundEntry(
            messageId: "c",
            nonce: "d",
            wire: wire,
            status: WatchOutboundWireStatus.phoneQueued,
            attemptCount: 0,
            nextRetryAtMs: 0,
            lastError: nil,
            updatedAtMs: 0
        )
        let display = WatchStateSyncEngine.fromOutbound(
            entry: entry,
            lastAck: nil,
            watchConnectedToPhone: true,
            nowMs: 100
        )
        XCTAssertEqual(display.phase, .phoneQueued)
        XCTAssertTrue(display.detailTr.contains("sunucuya ulaştı denmez"))
    }
}
