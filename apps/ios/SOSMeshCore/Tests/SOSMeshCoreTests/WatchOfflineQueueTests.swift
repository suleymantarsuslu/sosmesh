import XCTest
@testable import SOSMeshCore

final class WatchOfflineQueueTests: XCTestCase {
    func testEnqueueWhenPhoneUnreachableDoesNotClaimSent() {
        let store = InMemoryWatchOfflineQueueStore()
        let queue = WatchOfflineQueue(store: store)
        let wire = WatchSosCreateWire(messageId: "m1", nonce: "n1", sosType: "diger", createdAtMs: 1)
        let entry = queue.enqueueOrGetExisting(wire: wire, nowMs: 100, phoneReachable: false)
        XCTAssertEqual(entry.status, WatchOutboundWireStatus.phoneUnreachable)
        XCTAssertEqual(entry.lastError, "phone_not_reachable")
    }

    func testRetryBackoffIncreases() {
        let store = InMemoryWatchOfflineQueueStore()
        let queue = WatchOfflineQueue(store: store)
        let wire = WatchSosCreateWire(messageId: "m2", nonce: "n2", sosType: "diger", createdAtMs: 1)
        _ = queue.enqueueOrGetExisting(wire: wire, nowMs: 0, phoneReachable: true)
        let first = queue.markSendAttemptFailed(messageId: "m2", nowMs: 1_000, error: "timeout")
        XCTAssertEqual(first?.attemptCount, 1)
        XCTAssertEqual(first?.nextRetryAtMs, 1_000 + 5_000)
        let second = queue.markSendAttemptFailed(messageId: "m2", nowMs: 10_000, error: "timeout")
        XCTAssertEqual(second?.attemptCount, 2)
        XCTAssertEqual(second?.nextRetryAtMs, 10_000 + 15_000)
    }

    func testApplyPhoneAckQueued() {
        let store = InMemoryWatchOfflineQueueStore()
        let queue = WatchOfflineQueue(store: store)
        let wire = WatchSosCreateWire(messageId: "m3", nonce: "n3", sosType: "diger", createdAtMs: 1)
        _ = queue.enqueueOrGetExisting(wire: wire, nowMs: 0, phoneReachable: false)
        let updated = queue.applyPhoneAck(
            messageId: "m3",
            nonce: "n3",
            ackStatus: WatchPhoneAckStatus.queued,
            outboxDigest: "digest-1",
            nowMs: 500
        )
        XCTAssertEqual(updated?.status, WatchOutboundWireStatus.phoneQueued)
        XCTAssertNil(updated?.lastError)
    }

    func testListDueForRetrySkipsQueued() {
        let store = InMemoryWatchOfflineQueueStore()
        let queue = WatchOfflineQueue(store: store)
        let wire = WatchSosCreateWire(messageId: "m4", nonce: "n4", sosType: "diger", createdAtMs: 1)
        _ = queue.enqueueOrGetExisting(wire: wire, nowMs: 0, phoneReachable: false)
        _ = queue.applyPhoneAck(
            messageId: "m4",
            nonce: "n4",
            ackStatus: WatchPhoneAckStatus.queued,
            outboxDigest: "d",
            nowMs: 1
        )
        XCTAssertTrue(queue.listDueForRetry(nowMs: 999_999).isEmpty)
    }
}

final class WatchRetryPolicyTests: XCTestCase {
    func testShouldRetryAfterBackoff() {
        let entry = WatchOutboundEntry(
            messageId: "x",
            nonce: "y",
            wire: WatchSosCreateWire(messageId: "x", nonce: "y", sosType: "diger", createdAtMs: 0),
            status: WatchOutboundWireStatus.phoneUnreachable,
            attemptCount: 1,
            nextRetryAtMs: 10_000,
            lastError: "e",
            updatedAtMs: 0
        )
        XCTAssertFalse(WatchRetryPolicy.shouldRetry(entry: entry, nowMs: 9_000))
        XCTAssertTrue(WatchRetryPolicy.shouldRetry(entry: entry, nowMs: 10_000))
    }
}
