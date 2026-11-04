import Foundation
import SOSMeshCore
import WatchConnectivity

@MainActor
final class WatchAppModel: ObservableObject {
    @Published var confirmStep: WatchConfirmStep = .idle
    @Published var headline = "SOS"
    @Published var detail = String(localized: "watch.initial.detail")
    @Published var connectivityHeadline = ""
    @Published var showOfflineHelp = false

    private let store = InMemoryWatchOfflineQueueStore()
    private lazy var sessionBridge = WatchSessionBridge(store: store, model: self)
    private lazy var coordinator = WatchSosCoordinator(store: store, transport: sessionBridge)

    private var activeMessageId: String?
    private let meshHandoff = WatchMeshHandoff()
    private let identity = SosIdentityStore()
    @Published var meshHandoffStatus = ""
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
        headline = String(localized: "watch.cancel.headline")
        detail = String(localized: "watch.cancel.detail")
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
        if !sessionBridge.isPhoneReachable() {
            startMeshHandoff(nowMs: nowMs)
        }
    }

    /// iPhone unreachable + app in foreground: hand the watch's own SOS to the nearby phone with
    /// the lowest `h` over BLE (central only). Shows "peer received" at most, never delivered.
    private func startMeshHandoff(nowMs: Int64) {
        let composer = IosSosMessageComposer(cryptoConfig: CryptoConfigProvider.makeConfig())
        let context = SosInnerV2Context(senderKey: identity.senderKey(), seq: identity.nextSeq(), profile: nil, profileChanged: false)
        guard let composed = try? composer.compose(IosSosComposeRequest(note: "", languageTag: Locale.current.language.languageCode?.identifier ?? "en", nowMs: nowMs, innerV2: context)),
              let l1 = MeshCarry.encode(MeshCarry.wrap(l2: composed.wirePayload, messageId: composed.message.id, nowMs: nowMs)) else {
            return
        }
        let emergencyNumber = EmergencyNumberProvider.getEmergencyNumber()
        meshHandoffStatus = String(localized: "watch.mesh.searching")
        meshHandoff.start(messageId: composed.message.id, l1Payload: l1) { [weak self] outcome in
            Task { @MainActor in
                guard let self else { return }
                switch outcome {
                case .peerReceived: self.meshHandoffStatus = String(format: NSLocalizedString("watch.mesh.peer_received", comment: ""), emergencyNumber)
                case .noPeer: self.meshHandoffStatus = String(format: NSLocalizedString("watch.mesh.no_peer", comment: ""), emergencyNumber)
                case .failed: self.meshHandoffStatus = String(format: NSLocalizedString("watch.mesh.failed", comment: ""), emergencyNumber)
                }
            }
        }
    }

    func onDisappear() {
        // Foreground only: no background BLE promises on watchOS.
        meshHandoff.cancel()
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
        if confirmStep == .idle && activeMessageId == nil {
            detail = snap.userDetailTr
        }
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
