import XCTest
@testable import SOSMeshContracts

final class TransportOutboxTests: XCTestCase {
    func sourceRoot() -> String {
        if let envRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] {
            return envRoot
        }
        let currentFile = #filePath
        let parts = currentFile.split(separator: "/")
        let up = Array(repeating: "..", count: parts.count - 1).joined(separator: "/")
        return up
    }

    func testFixtureForwardChain() throws {
        let machine = try DeliveryStateMachine(sourceRoot: sourceRoot())
        let fixture = try StateTransitionLoader.load(sourceRoot: sourceRoot())
        var state = fixture.progressOrder[0]
        for next in fixture.progressOrder.dropFirst() {
            XCTAssertTrue(machine.canTransition(from: state, to: next))
            state = try machine.transition(from: state, to: next)
        }
        XCTAssertEqual(state, "CASE_IN_PROGRESS")
    }

    func testInvalidTransitionPeerToOperatorRejected() throws {
        let machine = try DeliveryStateMachine(sourceRoot: sourceRoot())
        XCTAssertFalse(machine.canTransition(from: "PEER_RECEIVED", to: "OPERATOR_SEEN"))
    }

    func testPeerReceivedDoesNotImplyServerAccepted() throws {
        let machine = try DeliveryStateMachine(sourceRoot: sourceRoot())
        let peer = try machine.transition(from: "LOCAL_SAVED", to: "PEER_RECEIVED")
        XCTAssertEqual(peer, "PEER_RECEIVED")
        XCTAssertNotEqual(peer, "SERVER_ACCEPTED")
    }

    func testDuplicateEnqueueSingleRow() throws {
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("outbox-swift-\(UUID().uuidString).db")
        defer { try? FileManager.default.removeItem(at: tmp) }
        let fixture = try StateTransitionLoader.load(sourceRoot: sourceRoot())
        let storePath = tmp.deletingPathExtension().appendingPathExtension("json").path
        let queue = try DiskOutboxQueue(
            storePath: storePath,
            defaultRetentionMs: fixture.defaultRetentionMs
        )
        let input = EnqueueInput(
            sosId: "swift-dup",
            digest: "d1",
            origin: "linux",
            encryptedBlobBase64: "YQ=="
        )
        _ = try queue.enqueue(input: input, nowMs: 100)
        _ = try queue.enqueue(input: input, nowMs: 200)
        XCTAssertEqual(try queue.listAll().count, 1)
    }

    func testReopenPreservesQueue() throws {
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("outbox-swift-reboot-\(UUID().uuidString).db")
        defer { try? FileManager.default.removeItem(at: tmp) }
        let fixture = try StateTransitionLoader.load(sourceRoot: sourceRoot())
        let storePath = tmp.deletingPathExtension().appendingPathExtension("json").path
        let q1 = try DiskOutboxQueue(storePath: storePath, defaultRetentionMs: fixture.defaultRetentionMs)
        _ = try q1.enqueue(
            input: EnqueueInput(sosId: "r1", digest: "d", origin: "linux", encryptedBlobBase64: "YQ=="),
            nowMs: 1
        )
        let q2 = try DiskOutboxQueue(storePath: storePath, defaultRetentionMs: fixture.defaultRetentionMs)
        XCTAssertEqual(try q2.listAll().count, 1)
    }

    func testPauseBlocksDueSendCount() throws {
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("outbox-swift-pause-\(UUID().uuidString).db")
        let storePath = tmp.deletingPathExtension().appendingPathExtension("json").path
        defer {
            try? FileManager.default.removeItem(at: tmp)
            try? FileManager.default.removeItem(atPath: storePath)
        }
        let fixture = try StateTransitionLoader.load(sourceRoot: sourceRoot())
        let queue = try DiskOutboxQueue(storePath: storePath, defaultRetentionMs: fixture.defaultRetentionMs)
        _ = try queue.enqueue(
            input: EnqueueInput(sosId: "p", digest: "d", origin: "linux", encryptedBlobBase64: "YQ=="),
            nowMs: 10
        )
        XCTAssertEqual(try queue.countDueForSend(nowMs: 10, paused: true), 0)
        XCTAssertEqual(try queue.countDueForSend(nowMs: 10, paused: false), 1)
    }

    func testPurgeExpiredRemovesRow() throws {
        let storePath = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("outbox-swift-exp-\(UUID().uuidString).json")
            .path
        defer { try? FileManager.default.removeItem(atPath: storePath) }
        let queue = try DiskOutboxQueue(storePath: storePath, defaultRetentionMs: 500)
        _ = try queue.enqueue(
            input: EnqueueInput(
                sosId: "e",
                digest: "d",
                origin: "linux",
                encryptedBlobBase64: "YQ==",
                retentionMs: 500
            ),
            nowMs: 0
        )
        XCTAssertEqual(try queue.purgeExpired(nowMs: 501), 1)
        XCTAssertTrue(try queue.listAll().isEmpty)
    }

    func testClockSkewRetryAtBoundaryMatchesSharedBackoff() throws {
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("outbox-swift-skew-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tmp) }
        let queue = try DiskOutboxQueue(storePath: tmp.path, defaultRetentionMs: 604_800_000)
        _ = try queue.enqueue(
            input: EnqueueInput(sosId: "skew-s", digest: "d", origin: "linux", encryptedBlobBase64: "YQ=="),
            nowMs: 1_000
        )
        let firstRetry = OutboxRetryPolicy.nextRetryAt(nowMs: 1_000, attempt: 1)
        XCTAssertEqual(firstRetry, 61_000)
        try queue.setRetryAt(sosId: "skew-s", digest: "d", retryAtMs: firstRetry, lastError: "offline")
        XCTAssertEqual(try queue.countDueForSend(nowMs: 60_999, paused: false), 0)
        XCTAssertEqual(try queue.countDueForSend(nowMs: 61_000, paused: false), 1)
        let secondRetry = OutboxRetryPolicy.nextRetryAt(nowMs: 62_000, attempt: 2)
        XCTAssertEqual(secondRetry, 182_000)
        try queue.setRetryAt(sosId: "skew-s", digest: "d", retryAtMs: secondRetry, lastError: "still-offline")
        XCTAssertEqual(try queue.countDueForSend(nowMs: 181_999, paused: false), 0)
        XCTAssertEqual(try queue.countDueForSend(nowMs: 182_000, paused: false), 1)
    }

    func testThousandPendingEnvelopesListable() throws {
        let storePath = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("outbox-swift-1k-\(UUID().uuidString).json")
            .path
        defer { try? FileManager.default.removeItem(atPath: storePath) }
        let queue = try DiskOutboxQueue(storePath: storePath, defaultRetentionMs: 604_800_000)
        for index in 0..<1000 {
            _ = try queue.enqueue(
                input: EnqueueInput(
                    sosId: "ios-adim47-\(index)",
                    digest: "d-\(index)",
                    origin: "ios-adim47",
                    encryptedBlobBase64: "YQ=="
                ),
                nowMs: Int64(index)
            )
        }
        XCTAssertEqual(try queue.listAll().count, 1000)
    }

    func testLowStorageRecoveryViaTtlPurge() throws {
        let storePath = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("outbox-swift-storage-\(UUID().uuidString).json")
            .path
        defer { try? FileManager.default.removeItem(atPath: storePath) }
        let queue = try DiskOutboxQueue(storePath: storePath, defaultRetentionMs: 500)
        for index in 0..<128 {
            _ = try queue.enqueue(
                input: EnqueueInput(
                    sosId: "exp-\(index)",
                    digest: "d-\(index)",
                    origin: "ios-adim47",
                    encryptedBlobBase64: "Yg==",
                    retentionMs: 100
                ),
                nowMs: 0
            )
        }
        XCTAssertEqual(try queue.purgeExpired(nowMs: 200), 128)
        XCTAssertTrue(try queue.listAll().isEmpty)
    }
}
