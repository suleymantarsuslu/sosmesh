import Foundation
import SOSMeshCore
import WatchConnectivity

final class WatchSessionBridge: NSObject, WatchCompanionTransport, WCSessionDelegate {
    private weak var model: WatchAppModel?
    private let store: WatchOfflineQueueStore

    init(store: WatchOfflineQueueStore, model: WatchAppModel) {
        self.store = store
        self.model = model
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func currentSnapshot() -> WatchConnectivitySnapshot {
        let session = WCSession.default
        return WatchConnectivitySendPlanner.snapshot(
            isPaired: session.isCompanionAppInstalled || session.activationState == .activated,
            sessionActivated: session.activationState == .activated,
            isReachable: session.isReachable,
            isCompanionAppInstalled: session.isCompanionAppInstalled,
            watchLocked: false,
            lowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled
        )
    }

    func isPhoneReachable() -> Bool {
        WatchConnectivitySendPlanner.isPhoneReachableForQueue(snapshot: currentSnapshot())
    }

    func sendCreateToPhone(
        payload: Data,
        sendMode: WatchConnectivitySendMode,
        onSuccess: @escaping () -> Void,
        onFailure: @escaping (String) -> Void
    ) {
        let session = WCSession.default
        let message: [String: Any] = [
            WatchCompanionPaths.MessageKey.path: WatchCompanionPaths.sosCreate,
            WatchCompanionPaths.MessageKey.payloadBase64: payload.base64EncodedString(),
        ]
        switch sendMode {
        case .sendMessage:
            session.sendMessage(message, replyHandler: { _ in onSuccess() }, errorHandler: { error in
                onFailure(error.localizedDescription)
            })
        case .transferUserInfo:
            session.transferUserInfo(message)
            onSuccess()
        case .none:
            onFailure("send_mode_none")
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            model?.refreshConnectivityCopy()
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncoming(message)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handleIncoming(userInfo)
    }

    private func handleIncoming(_ message: [String: Any]) {
        guard let path = message[WatchCompanionPaths.MessageKey.path] as? String,
              path == WatchCompanionPaths.phoneAck,
              let b64 = message[WatchCompanionPaths.MessageKey.payloadBase64] as? String,
              let data = Data(base64Encoded: b64),
              let ack = try? WatchCompanionCodec.decodeAck(data)
        else { return }
        Task { @MainActor in
            model?.applyPhoneAck(ack)
        }
    }
}
