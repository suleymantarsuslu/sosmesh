import XCTest
@testable import SOSMeshCore

final class BroadcastRelayTests: XCTestCase {
    func testBroadcastRelayedToPeerAndStored() {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        var notifiedBroadcast: ServerBroadcast?
        var verifyCallCount = 0
        
        let nodeA = MeshV2Node(
            outbox: NullSosOutboxService(),
            relayIdHex: "aaa",
            receiptKeySpkiBase64: "test",
            directory: nil,
            nowMs: nowMs
        )
        nodeA.broadcastVerifier = { _ in
            verifyCallCount += 1
            return true
        }
        nodeA.broadcastNotifier = { _ in }
        nodeA.locationProvider = { (40.0, -74.0) }
        
        let nodeB = MeshV2Node(
            outbox: NullSosOutboxService(),
            relayIdHex: "bbb",
            receiptKeySpkiBase64: "test",
            directory: nil,
            nowMs: nowMs
        )
        nodeB.broadcastVerifier = { _ in true }
        nodeB.broadcastNotifier = { broadcast in
            notifiedBroadcast = broadcast
        }
        nodeB.locationProvider = { (40.0, -74.0) }
        
        let broadcast = ServerBroadcast(
            id: "test-broadcast",
            title: "Test Alert",
            body: "Test body",
            severity: "warning",
            createdAt: MeshV2.iso8601(ms: nowMs),
            expiresAt: MeshV2.iso8601(ms: nowMs + 3600_000),
            regionLat: 40.0,
            regionLng: -74.0,
            regionRadiusKm: 50.0,
            signature: "test-sig",
            hopsLeft: 8
        )
        
        XCTAssertTrue(nodeA.broadcasts.put(broadcast, receivedAtMs: nowMs))
        
        let taken = nodeA.takeBroadcastFor(peerId: "peer-b", nowMs: nowMs)
        XCTAssertNotNil(taken)
        XCTAssertEqual(taken?.hopsLeft, 7)
        
        let secondTake = nodeA.takeBroadcastFor(peerId: "peer-b", nowMs: nowMs)
        XCTAssertNil(secondTake, "Should not offer same broadcast to same peer twice")
        
        if let taken = taken {
            nodeB.onBroadcastFrame(taken, nowMs: nowMs)
        }
        
        XCTAssertNotNil(notifiedBroadcast, "Notifier should be called")
        XCTAssertEqual(nodeB.broadcasts.ordered().count, 1, "Broadcast should be stored in node B")
        XCTAssertEqual(verifyCallCount, 1, "Verifier should be called once")
    }
    
    func testBroadcastRejectedWhenVerifierMissing() {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        
        let node = MeshV2Node(
            outbox: NullSosOutboxService(),
            relayIdHex: "aaa",
            receiptKeySpkiBase64: "test",
            directory: nil,
            nowMs: nowMs
        )
        
        let broadcast = ServerBroadcast(
            id: "test-unverified",
            title: "Test",
            body: "Body",
            severity: "info",
            createdAt: MeshV2.iso8601(ms: nowMs),
            expiresAt: MeshV2.iso8601(ms: nowMs + 3600_000),
            regionLat: nil,
            regionLng: nil,
            regionRadiusKm: nil,
            signature: "sig",
            hopsLeft: 8
        )
        
        node.onBroadcastFrame(broadcast, nowMs: nowMs)
        
        XCTAssertEqual(node.broadcasts.ordered().count, 0, "Broadcast should be rejected when verifier is nil")
    }
    
    func testBroadcastWithZeroHopsNotOffered() {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        
        let node = MeshV2Node(
            outbox: NullSosOutboxService(),
            relayIdHex: "aaa",
            receiptKeySpkiBase64: "test",
            directory: nil,
            nowMs: nowMs
        )
        node.broadcastVerifier = { _ in true }
        node.broadcastNotifier = { _ in }
        node.locationProvider = { nil }
        
        let broadcast = ServerBroadcast(
            id: "expired-broadcast",
            title: "Test",
            body: "Body",
            severity: "info",
            createdAt: MeshV2.iso8601(ms: nowMs),
            expiresAt: MeshV2.iso8601(ms: nowMs + 3600_000),
            regionLat: nil,
            regionLng: nil,
            regionRadiusKm: nil,
            signature: "sig",
            hopsLeft: 0
        )
        
        XCTAssertTrue(node.broadcasts.put(broadcast, receivedAtMs: nowMs))
        
        let taken = node.takeBroadcastFor(peerId: "peer-c", nowMs: nowMs)
        XCTAssertNil(taken, "Broadcast with zero hops should not be offered")
    }
}

final class NullSosOutboxService: SosOutboxService {
    func listEntries() throws -> [OutboxEntryMeta] { [] }
    func addEntry(sosId: String, digest: String, origin: String, encryptedBlobBase64: String, nowMs: Int64, expiresAtMs: Int64) throws {}
    func removeEntry(sosId: String, digest: String) throws {}
    func markPeerReceived(sosId: String, digest: String, nowMs: Int64) throws {}
    func markServerAccepted(sosId: String, digest: String, fromState: String, nowMs: Int64) throws {}
    func setRetryAt(sosId: String, digest: String, retryAtMs: Int64, lastError: String?) throws {}
}
