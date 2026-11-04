import Foundation
import SOSMeshContracts

public final class SosOutboxService: OutboxQueueUpdating, @unchecked Sendable {
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

    /// Origin tag for envelopes received from a nearby phone and waiting to be forwarded to the server.
    public static let relayOrigin = "relay"

    /// Persists a received SOS envelope (opaque bytes) for forwarding. Idempotent per (sosId, digest).
    @discardableResult
    public func enqueueRelayEnvelope(
        sosId: String,
        digest: String,
        envelope: Data,
        nowMs: Int64
    ) throws -> OutboxEntryMeta {
        try queue.enqueue(
            input: EnqueueInput(
                sosId: sosId,
                digest: digest,
                origin: SosOutboxService.relayOrigin,
                encryptedBlobBase64: envelope.base64EncodedString()
            ),
            nowMs: nowMs
        )
    }

    @discardableResult
    public func removeEntry(sosId: String, digest: String) throws -> Bool {
        try queue.remove(sosId: sosId, digest: digest)
    }

    public func listEntries() throws -> [OutboxEntryMeta] {
        try queue.listAll()
    }

    public func updateState(
        sosId: String,
        digest: String,
        state: String,
        nowMs: Int64,
        lastError: String?
    ) throws -> OutboxEntryMeta? {
        guard let existing = try queue.getByKey(sosId: sosId, digest: digest) else {
            return nil
        }
        _ = try stateMachine.transition(from: existing.state, to: state)
        return try queue.updateState(
            sosId: sosId,
            digest: digest,
            state: state,
            nowMs: nowMs,
            lastError: lastError
        )
    }

    public func setRetryAt(
        sosId: String,
        digest: String,
        retryAtMs: Int64,
        lastError: String?
    ) throws {
        try queue.setRetryAt(sosId: sosId, digest: digest, retryAtMs: retryAtMs, lastError: lastError)
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

    @discardableResult
    public func markServerAccepted(
        sosId: String,
        digest: String,
        fromState: String,
        nowMs: Int64
    ) throws -> String {
        // A verified server receipt for a direct online upload may arrive while the entry is still
        // LOCAL_SAVED (no peer ACK happened). That is a real server acceptance, not a peer ACK.
        let next: String
        if fromState == "LOCAL_SAVED" {
            next = "SERVER_ACCEPTED"
        } else {
            next = try stateMachine.transition(from: fromState, to: "SERVER_ACCEPTED")
        }
        _ = try queue.updateState(
            sosId: sosId,
            digest: digest,
            state: next,
            nowMs: nowMs,
            lastError: nil
        )
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
