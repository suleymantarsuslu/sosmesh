import Foundation
import SOSMeshContracts
@testable import SOSMeshCore
import XCTest

private final class InMemoryWatchPhoneOutbox: WatchPhoneOutboxPort, @unchecked Sendable {
    private var entries: [OutboxEntryMeta] = []
    private let lock = NSLock()

    func listAll() throws -> [OutboxEntryMeta] {
        lock.lock()
        defer { lock.unlock() }
        return entries
    }

    func enqueue(input: EnqueueInput, nowMs: Int64) throws -> OutboxEntryMeta {
        lock.lock()
        defer { lock.unlock() }
        let meta = OutboxEntryMeta(
            sosId: input.sosId,
            digest: input.digest,
            origin: input.origin,
            encryptedBlobBase64: input.encryptedBlobBase64,
            state: "LOCAL_ONLY",
            retryAtMs: nowMs,
            expiresAtMs: nowMs + 86_400_000,
            lastError: nil,
            createdAtMs: nowMs,
            updatedAtMs: nowMs
        )
        entries.append(meta)
        return meta
    }
}

final class PhoneWatchSosIngressTests: XCTestCase {
    func testIdempotentDuplicateAck() throws {
        let outbox = InMemoryWatchPhoneOutbox()
        let ingress = PhoneWatchSosIngress(outbox: outbox)
        let wire = WatchSosCreateWire(messageId: "id-1", nonce: "nonce-1", sosType: "diger", createdAtMs: 10)
        let payload = try WatchCompanionCodec.encodeCreate(wire)
        let first = try ingress.handleCreatePayload(payload: payload, nowMs: 100)
        XCTAssertTrue(first.enqueued)
        XCTAssertEqual(first.ack.status, WatchPhoneAckStatus.queued)
        let second = try ingress.handleCreatePayload(payload: payload, nowMs: 200)
        XCTAssertFalse(second.enqueued)
        XCTAssertEqual(second.ack.status, WatchPhoneAckStatus.duplicate)
    }

    func testOriginIsWatchOs() throws {
        let outbox = InMemoryWatchPhoneOutbox()
        let ingress = PhoneWatchSosIngress(outbox: outbox)
        let wire = WatchSosCreateWire(messageId: "id-2", nonce: "nonce-2", sosType: "diger", createdAtMs: 10)
        let payload = try WatchCompanionCodec.encodeCreate(wire)
        _ = try ingress.handleCreatePayload(payload: payload, nowMs: 50)
        let listed = try outbox.listAll()
        XCTAssertEqual(listed.count, 1)
        XCTAssertEqual(listed[0].origin, "watch_os")
    }
}
