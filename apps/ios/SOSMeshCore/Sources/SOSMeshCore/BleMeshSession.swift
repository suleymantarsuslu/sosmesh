import Foundation
import SOSMeshContracts

/// Testable BLE mesh session wiring (transfer engine + outbox send scheduling).
public final class BleMeshSession {
    public let engine: BleTransferEngine
    private let outbox: SosOutboxService
    private let peerTracker: SosPeerDeliveryTracker
    private let nowMs: () -> Int64
    /// The engine only keeps a weak reference to its relay listener; the session owns the router.
    private let incomingRouter: BleIncomingPayloadRouter

    public init(
        serverOutbound: GattOutboundWriting,
        clientOutbound: GattOutboundWriting,
        outbox: SosOutboxService,
        incomingRouter: BleIncomingPayloadRouter,
        clock: BleTransferClock = SystemBleTransferClock(),
        rng: BleTransferRng = SystemBleTransferRng(),
        nowMs: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }
    ) {
        self.outbox = outbox
        self.nowMs = nowMs
        self.incomingRouter = incomingRouter
        peerTracker = SosPeerDeliveryTracker(outbox: outbox, nowMs: nowMs)
        engine = BleTransferEngine(
            serverOutbound: serverOutbound,
            clientOutbound: clientOutbound,
            peerDeliveryTracker: peerTracker,
            clock: clock,
            rng: rng
        )
        engine.setRelayListener(incomingRouter)
    }

    public func sendDueOutboxEntryIfReady(gattReady: Bool) throws -> Bool {
        guard gattReady else { return false }
        // A finished (completed/failed) transfer is reset first; never start while one is in flight.
        guard engine.prepareSenderForNextTransfer() else { return false }
        guard let due = try nextDueOwnEntry() else { return false }
        guard let payload = Data(base64Encoded: due.encryptedBlobBase64) else { return false }
        engine.sendOutbound(sosId: due.sosId, digest: due.digest, payload: payload)
        return true
    }

    /// True when an own (non-relay) SOS is waiting to be handed to a peer. Drives connecting.
    public func hasDueOwnOutbound() -> Bool {
        ((try? nextDueOwnEntry()) ?? nil) != nil
    }

    /// Relay copies are forwarded to the server only; they are never re-broadcast over BLE here.
    private func nextDueOwnEntry() throws -> OutboxEntryMeta? {
        let now = nowMs()
        return try outbox.listEntries().first {
            $0.state == "LOCAL_SAVED" && $0.origin != SosOutboxService.relayOrigin && $0.retryAtMs <= now
        }
    }

    /// Starts one mesh v2 transfer (own L1, carried L1, tombstone batch or bare v1).
    public func sendPayload(sosId: String, digest: String, payload: Data) -> Bool {
        guard engine.prepareSenderForNextTransfer() else { return false }
        engine.sendOutbound(sosId: sosId, digest: digest, payload: payload)
        return true
    }

    public func observeTransferFinished(_ handler: @escaping (SosPeerDeliveryTracker.ActiveTransfer, Bool) -> Void) {
        peerTracker.onActiveFinished = handler
    }

    /// Diagnostics hooks (counters only): own SOS reached a peer / transfer failed.
    public func observeSendResults(completed: @escaping () -> Void, failed: @escaping (BleTransferErrorCode) -> Void) {
        peerTracker.onPeerAckCompleted = completed
        peerTracker.onTransferFailed = failed
    }
}
