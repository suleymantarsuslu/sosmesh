import Foundation
import SOSMeshContracts

public protocol OutboxQueueUpdating: AnyObject {
    func updateState(
        sosId: String,
        digest: String,
        state: String,
        nowMs: Int64,
        lastError: String?
    ) throws -> OutboxEntryMeta?

    func setRetryAt(
        sosId: String,
        digest: String,
        retryAtMs: Int64,
        lastError: String?
    ) throws
}

public final class SosPeerDeliveryTracker {
    public struct ActiveTransfer: Equatable {
        public let sosId: String
        public let digest: String

        public init(sosId: String, digest: String) {
            self.sosId = sosId
            self.digest = digest
        }
    }

    public var active: ActiveTransfer?
    /// Diagnostics hooks (no payload data): peer ACK completed / transfer failed.
    public var onPeerAckCompleted: (() -> Void)?
    public var onTransferFailed: ((BleTransferErrorCode) -> Void)?
    private let outbox: OutboxQueueUpdating
    private let nowMs: () -> Int64
    private var senderListenerRetention: TrackerListener?

    public init(outbox: OutboxQueueUpdating, nowMs: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
        self.outbox = outbox
        self.nowMs = nowMs
    }

    public func attachSenderListener(_ sender: BleTransferSender) {
        let listener = TrackerListener(tracker: self)
        senderListenerRetention = listener
        sender.setListener(listener)
    }

    private final class TrackerListener: BleTransferSender.Listener {
        private weak var tracker: SosPeerDeliveryTracker?

        init(tracker: SosPeerDeliveryTracker) {
            self.tracker = tracker
        }

        func onCompleted() {
            guard let tracker, let ctx = tracker.active else { return }
            _ = try? tracker.outbox.updateState(
                sosId: ctx.sosId,
                digest: ctx.digest,
                state: "PEER_RECEIVED",
                nowMs: tracker.nowMs(),
                lastError: nil
            )
            tracker.active = nil
            tracker.onPeerAckCompleted?()
        }

        func onFailed(code: BleTransferErrorCode, message: String) {
            guard let tracker, let ctx = tracker.active else { return }
            try? tracker.outbox.setRetryAt(
                sosId: ctx.sosId,
                digest: ctx.digest,
                retryAtMs: tracker.nowMs() + 5_000,
                lastError: message
            )
            tracker.active = nil
            tracker.onTransferFailed?(code)
        }
    }
}

public final class BleTransferEngine {
    private let peripheralTransport: GattBleTransferTransport
    private let centralTransport: GattBleTransferTransport
    private let receiver: BleTransferReceiver
    private let sender: BleTransferSender
    private let peerDeliveryTracker: SosPeerDeliveryTracker

    public init(
        serverOutbound: GattOutboundWriting,
        clientOutbound: GattOutboundWriting,
        peerDeliveryTracker: SosPeerDeliveryTracker,
        config: BleTransferConfig = BleTransferConfig(),
        clock: BleTransferClock = SystemBleTransferClock(),
        rng: BleTransferRng = SystemBleTransferRng()
    ) {
        peripheralTransport = GattBleTransferTransport(outbound: serverOutbound)
        centralTransport = GattBleTransferTransport(outbound: clientOutbound)
        // The receiving side must not cap the MTU the sender negotiates below its real link limit.
        var receiverConfig = config
        receiverConfig.mtu = max(config.mtu, BleTransferProtocolConstants.maxMtu)
        receiver = BleTransferReceiver(transport: peripheralTransport, config: receiverConfig, clock: clock)
        sender = BleTransferSender(transport: centralTransport, config: config, clock: clock, rng: rng)
        self.peerDeliveryTracker = peerDeliveryTracker
        peerDeliveryTracker.attachSenderListener(sender)
    }

    public func setRelayListener(_ listener: BleTransferReceiver.Listener) {
        receiver.setListener(listener)
    }

    public func sendOutbound(sosId: String, digest: String, payload: Data) {
        peerDeliveryTracker.active = SosPeerDeliveryTracker.ActiveTransfer(sosId: sosId, digest: digest)
        sender.startTransfer(payload)
    }

    public func receiverState() -> BleTransferState { receiver.getState() }
    public func senderState() -> BleTransferState { sender.getState() }

    public func deliverPeripheralWrite(uuid: String, value: Data) {
        peripheralTransport.deliverIncoming(uuid: uuid, value: value)
    }

    public func deliverCentralNotification(uuid: String, value: Data) {
        centralTransport.deliverIncoming(uuid: uuid, value: value)
    }

    public func onGattReady() {}

    /// Sets the sender MTU from the real GATT link (`maximumWriteValueLength(for:) + 3`).
    public func setSenderMtu(_ mtu: Int) {
        sender.setMtu(min(max(mtu, BleTransferProtocolConstants.minMtu), BleTransferProtocolConstants.maxMtu))
    }

    /// True when a new outbound transfer may start (a finished transfer is reset first).
    @discardableResult
    public func prepareSenderForNextTransfer() -> Bool {
        sender.resetToIdle()
        return sender.getState() == .idle
    }

    /// Central link dropped: fail the in-flight send (outbox retry is scheduled by the tracker).
    public func senderLinkLost() {
        sender.abort("Transport disconnected")
        sender.resetToIdle()
    }

    /// Remote central went away: drop partial receive state so the next HELLO starts clean.
    public func receiverLinkLost() {
        receiver.resetToIdle()
    }
}
