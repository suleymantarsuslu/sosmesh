import Foundation
import SOSMeshContracts

public struct SosOutboxService: Sendable {
    private let queue: DiskOutboxQueue
    private let stateMachine: DeliveryStateMachine

    public init(storePath: String, sourceRoot: String) throws {
        let fixture = try StateTransitionLoader.load(sourceRoot: sourceRoot)
        queue = DiskOutboxQueue(storePath: storePath, defaultRetentionMs: fixture.defaultRetentionMs)
        stateMachine = DeliveryStateMachine(fixture: fixture)
    }

    @discardableResult
    public func enqueueLocalSos(
        input: EnqueueInput,
        nowMs: Int64
    ) throws -> OutboxEntryMeta {
        try queue.enqueue(input: input, nowMs: nowMs)
    }

    public func listEntries() throws -> [OutboxEntryMeta] {
        try queue.listAll()
    }

    @discardableResult
    public func markPeerReceived(
        sosId: String,
        digest: String,
        fromState: String
    ) throws -> String {
        let next = try stateMachine.transition(from: fromState, to: "PEER_RECEIVED")
        validatePeerAckSemantics(next)
        return next
    }

    /// Peer ACK must not be treated as operator/server acceptance (ADIM 10 contract).
    public func validatePeerAckSemantics(_ state: String) {
        precondition(state == "PEER_RECEIVED")
        precondition(state != "SERVER_ACCEPTED")
    }

    public func peerAckIsNotServerAccepted(_ peerState: String) -> Bool {
        peerState == "PEER_RECEIVED"
    }
}
