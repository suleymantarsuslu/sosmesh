import Foundation
import SOSMeshContracts

public protocol WatchCompanionTransport: Sendable {
    func isPhoneReachable() -> Bool
    func sendCreateToPhone(
        payload: Data,
        sendMode: WatchConnectivitySendMode,
        onSuccess: @escaping () -> Void,
        onFailure: @escaping (String) -> Void
    )
}

public final class WatchSosCoordinator: @unchecked Sendable {
    private let store: WatchOfflineQueueStore
    private let transport: WatchCompanionTransport
    private let queue: WatchOfflineQueue

    public init(store: WatchOfflineQueueStore, transport: WatchCompanionTransport) {
        self.store = store
        self.transport = transport
        queue = WatchOfflineQueue(store: store)
    }

    public func buildCreateWire(nowMs: Int64, messageId: String, nonce: String) -> WatchSosCreateWire {
        WatchSosCreateWire(
            messageId: messageId,
            nonce: nonce,
            sosType: "diger",
            personCount: 1,
            note: "",
            language: "tr",
            createdAtMs: nowMs
        )
    }

    public func submitConfirmed(
        wire: WatchSosCreateWire,
        nowMs: Int64,
        sendMode: WatchConnectivitySendMode
    ) -> WatchOutboundEntry {
        let reachable = transport.isPhoneReachable()
        let entry = queue.enqueueOrGetExisting(wire: wire, nowMs: nowMs, phoneReachable: reachable)
        if entry.status != WatchOutboundWireStatus.phoneQueued {
            dispatch(entry: entry, nowMs: nowMs, sendMode: sendMode)
        }
        return store.get(messageId: wire.messageId) ?? entry
    }

    public func applyPhoneAck(ack: WatchPhoneAckWire, nowMs: Int64) -> WatchOutboundEntry? {
        queue.applyPhoneAck(
            messageId: ack.messageId,
            nonce: ack.nonce,
            ackStatus: ack.status,
            outboxDigest: ack.outboxDigest,
            nowMs: nowMs
        )
    }

    public func retryDue(nowMs: Int64, sendMode: WatchConnectivitySendMode) {
        for entry in queue.listDueForRetry(nowMs: nowMs) {
            dispatch(entry: entry, nowMs: nowMs, sendMode: sendMode)
        }
    }

    public func displayState(
        activeMessageId: String?,
        lastAck: WatchPhoneAckWire?,
        nowMs: Int64
    ) -> WatchDisplayState {
        let entry = activeMessageId.flatMap { store.get(messageId: $0) }
        return WatchStateSyncEngine.fromOutbound(
            entry: entry,
            lastAck: lastAck,
            watchConnectedToPhone: transport.isPhoneReachable(),
            nowMs: nowMs
        )
    }

    private func dispatch(
        entry: WatchOutboundEntry,
        nowMs: Int64,
        sendMode: WatchConnectivitySendMode
    ) {
        guard let payload = try? WatchCompanionCodec.encodeCreate(entry.wire) else {
            _ = queue.markSendAttemptFailed(messageId: entry.messageId, nowMs: nowMs, error: "encode_failed")
            return
        }
        if !transport.isPhoneReachable() {
            _ = queue.markSendAttemptFailed(messageId: entry.messageId, nowMs: nowMs, error: "phone_not_reachable")
            return
        }
        transport.sendCreateToPhone(
            payload: payload,
            sendMode: sendMode,
            onSuccess: {},
            onFailure: { error in
                _ = self.queue.markSendAttemptFailed(messageId: entry.messageId, nowMs: nowMs, error: error)
            }
        )
    }
}

public protocol WatchPhoneOutboxPort: Sendable {
    func listAll() throws -> [OutboxEntryMeta]
    func enqueue(input: EnqueueInput, nowMs: Int64) throws -> OutboxEntryMeta
}

public struct PhoneWatchIngressResult: Equatable, Sendable {
    public let ack: WatchPhoneAckWire
    public let enqueued: Bool

    public init(ack: WatchPhoneAckWire, enqueued: Bool) {
        self.ack = ack
        self.enqueued = enqueued
    }
}

public struct PhoneWatchSosIngress: Sendable {
    private let outbox: WatchPhoneOutboxPort
    private let digestBuilder: WatchIngressDigestBuilder

    public init(outbox: WatchPhoneOutboxPort, digestBuilder: WatchIngressDigestBuilder = WatchIngressDigestBuilder()) {
        self.outbox = outbox
        self.digestBuilder = digestBuilder
    }

    public func handleCreatePayload(payload: Data, nowMs: Int64) throws -> PhoneWatchIngressResult {
        let wire = try WatchCompanionCodec.decodeCreate(payload)
        try validate(wire: wire)
        let existing = try outbox.listAll().first { $0.sosId == wire.messageId }
        if let existing {
            return PhoneWatchIngressResult(
                ack: WatchPhoneAckWire(
                    messageId: wire.messageId,
                    nonce: wire.nonce,
                    status: WatchPhoneAckStatus.duplicate,
                    outboxDigest: existing.digest,
                    phoneNowMs: nowMs,
                    detail: "already_in_outbox"
                ),
                enqueued: false
            )
        }
        let digest = try digestBuilder.digest(for: wire)
        let placeholderBlob = "YQ=="
        _ = try outbox.enqueue(
            input: EnqueueInput(
                sosId: wire.messageId,
                digest: digest,
                origin: "watch_os",
                encryptedBlobBase64: placeholderBlob
            ),
            nowMs: nowMs
        )
        return PhoneWatchIngressResult(
            ack: WatchPhoneAckWire(
                messageId: wire.messageId,
                nonce: wire.nonce,
                status: WatchPhoneAckStatus.queued,
                outboxDigest: digest,
                phoneNowMs: nowMs
            ),
            enqueued: true
        )
    }

    public func buildAckData(result: PhoneWatchIngressResult) throws -> Data {
        try WatchCompanionCodec.encodeAck(result.ack)
    }

    private func validate(wire: WatchSosCreateWire) throws {
        guard wire.version == 1 else {
            throw WatchIngressError.unsupportedVersion
        }
        guard !wire.messageId.isEmpty, !wire.nonce.isEmpty else {
            throw WatchIngressError.missingIdentity
        }
    }
}

public enum WatchIngressError: Error {
    case unsupportedVersion
    case missingIdentity
}

public struct WatchIngressDigestBuilder: Sendable {
    public init() {}

    public func digest(for wire: WatchSosCreateWire) throws -> String {
        let canonical = "\(wire.messageId)|\(wire.nonce)|\(wire.sosType)|\(wire.createdAtMs)"
        let data = Data(canonical.utf8)
        return data.base64EncodedString()
    }
}
