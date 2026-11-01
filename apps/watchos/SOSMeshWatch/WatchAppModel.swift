import Foundation
import SOSMeshCore
import WatchConnectivity

@MainActor
final class WatchAppModel: ObservableObject {
    @Published var confirmStep: WatchConfirmStep = .idle
    @Published var headline = "SOS"
    @Published var detail = "Acil durumda iki adımda onaylayın."
    @Published var connectivityHeadline = ""
    @Published var showOfflineHelp = false

    private let store = InMemoryWatchOfflineQueueStore()
    private lazy var sessionBridge = WatchSessionBridge(store: store, model: self)
    private lazy var coordinator = WatchSosCoordinator(store: store, transport: sessionBridge)

    private var activeMessageId: String?
    private var lastAck: WatchPhoneAckWire?

    func onAppear() {
        sessionBridge.activate()
        refreshConnectivityCopy()
    }

    func onSosPressStart() {
        if confirmStep == .idle {
            confirmStep = .firstArmed
        }
    }

    func onSosPressRelease() {
        if confirmStep == .firstArmed {
            confirmStep = .confirmDialog
        }
    }

    func onConfirmCancel() {
        confirmStep = .cancelled
        headline = "SOS gönderilmedi"
        detail = "İptal edildi."
    }

    func onConfirmSend(nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) {
        let messageId = UUID().uuidString
        let nonce = UUID().uuidString
        let wire = coordinator.buildCreateWire(nowMs: nowMs, messageId: messageId, nonce: nonce)
        let snap = sessionBridge.currentSnapshot()
        _ = coordinator.submitConfirmed(wire: wire, nowMs: nowMs, sendMode: snap.sendMode)
        activeMessageId = wire.messageId
        refreshStatus(nowMs: nowMs)
        confirmStep = .idle
    }

    func refreshStatus(nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) {
        let display = coordinator.displayState(
            activeMessageId: activeMessageId,
            lastAck: lastAck,
            nowMs: nowMs
        )
        headline = display.headlineTr
        detail = display.detailTr
        if display.phase == .phoneUnreachable {
            confirmStep = .idle
        }
        coordinator.retryDue(nowMs: nowMs, sendMode: sessionBridge.currentSnapshot().sendMode)
    }

    func refreshConnectivityCopy() {
        let snap = sessionBridge.currentSnapshot()
        connectivityHeadline = snap.userHeadlineTr
    }

    func applyPhoneAck(_ ack: WatchPhoneAckWire) {
        lastAck = ack
        activeMessageId = ack.messageId
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        _ = coordinator.applyPhoneAck(ack: ack, nowMs: nowMs)
        refreshStatus(nowMs: nowMs)
    }
}

enum WatchConfirmStep {
    case idle
    case firstArmed
    case confirmDialog
    case cancelled
}
