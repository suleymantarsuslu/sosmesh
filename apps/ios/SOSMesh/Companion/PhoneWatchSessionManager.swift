import Foundation
import SOSMeshCore
import WatchConnectivity

final class PhoneWatchSessionManager: NSObject, @preconcurrency WCSessionDelegate {
    private let ingress: PhoneWatchSosIngress
    private var session: WCSession?

    nonisolated init(ingress: PhoneWatchSosIngress) {
        self.ingress = ingress
        super.init()
    }

    nonisolated func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
        self.session = session
    }

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        handle(message: message, replyHandler: replyHandler)
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handle(message: userInfo, replyHandler: nil)
    }

    nonisolated private func handle(message: [String: Any], replyHandler: (([String: Any]) -> Void)?) {
        guard let path = message[WatchCompanionPaths.MessageKey.path] as? String,
              path == WatchCompanionPaths.sosCreate,
              let b64 = message[WatchCompanionPaths.MessageKey.payloadBase64] as? String,
              let data = Data(base64Encoded: b64)
        else {
            replyHandler?(["status": "ignored"])
            return
        }
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        do {
            let result = try ingress.handleCreatePayload(payload: data, nowMs: nowMs)
            let ackData = try ingress.buildAckData(result: result)
            let ackMessage: [String: Any] = [
                WatchCompanionPaths.MessageKey.path: WatchCompanionPaths.phoneAck,
                WatchCompanionPaths.MessageKey.payloadBase64: ackData.base64EncodedString(),
            ]
            if let replyHandler {
                replyHandler(["status": "ok"])
            }
            self.session?.sendMessage(ackMessage, replyHandler: nil, errorHandler: nil)
            self.session?.transferUserInfo(ackMessage)
        } catch {
            replyHandler?(["status": "error"])
        }
    }
}
