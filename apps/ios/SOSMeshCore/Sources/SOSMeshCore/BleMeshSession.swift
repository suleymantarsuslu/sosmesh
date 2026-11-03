import Foundation

/// Testable BLE mesh session wiring (transfer engine + outbox send scheduling).
public final class BleMeshSession {
    public let engine: BleTransferEngine
    private let outbox: SosOutboxService
    private let peerTracker: SosPeerDeliveryTracker
    private let nowMs: () -> Int64

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
        let entries = try outbox.listEntries()
        let now = nowMs()
        guard let due = entries.first(where: { $0.state == "LOCAL_SAVED" && $0.retryAtMs <= now }) else {
            return false
        }
        guard let payload = Data(base64Encoded: due.encryptedBlobBase64) else { return false }
        engine.sendOutbound(sosId: due.sosId, digest: due.digest, payload: payload)
        return true
    }
}
