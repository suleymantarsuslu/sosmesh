import Foundation

public enum WatchUserFacingPhase: String, Sendable {
    case idle
    case confirmRequired
    case sending
    case phoneUnreachable
    case waitingPhoneAck
    case phoneQueued
    case failed
    case stale
}

public struct WatchDisplayState: Equatable, Sendable {
    public let phase: WatchUserFacingPhase
    public let headlineTr: String
    public let detailTr: String
    public let showsFalseSuccess: Bool
    public let messageId: String?

    public init(
        phase: WatchUserFacingPhase,
        headlineTr: String,
        detailTr: String,
        showsFalseSuccess: Bool,
        messageId: String? = nil
    ) {
        self.phase = phase
        self.headlineTr = headlineTr
        self.detailTr = detailTr
        self.showsFalseSuccess = showsFalseSuccess
        self.messageId = messageId
    }
}

public enum WatchStateSyncEngine {
    private static let staleAfterMs: Int64 = 120_000

    public static func fromOutbound(
        entry: WatchOutboundEntry?,
        lastAck: WatchPhoneAckWire?,
        watchConnectedToPhone: Bool,
        nowMs: Int64
    ) -> WatchDisplayState {
        guard let entry else {
            return idle()
        }
        let ackFresh =
            lastAck != nil
            && lastAck?.messageId == entry.messageId
            && lastAck?.nonce == entry.nonce
            && (nowMs - (lastAck?.phoneNowMs ?? 0)) <= staleAfterMs

        switch entry.status {
        case WatchOutboundWireStatus.phoneQueued:
            return WatchDisplayState(
                phase: .phoneQueued,
                headlineTr: "Telefona kaydedildi",
                detailTr: "Telefon kuyruğuna alındı; sunucuya ulaştı denmez.",
                showsFalseSuccess: false,
                messageId: entry.messageId
            )
        case WatchOutboundWireStatus.awaitingPhone:
            if watchConnectedToPhone {
                return WatchDisplayState(
                    phase: .waitingPhoneAck,
                    headlineTr: "Telefona iletiliyor",
                    detailTr: "Telefon onayı bekleniyor.",
                    showsFalseSuccess: false,
                    messageId: entry.messageId
                )
            }
            return unreachable(messageId: entry.messageId)
        case WatchOutboundWireStatus.phoneUnreachable:
            return unreachable(messageId: entry.messageId)
        case WatchOutboundWireStatus.failed:
            return WatchDisplayState(
                phase: .failed,
                headlineTr: "Telefona iletilemedi",
                detailTr: entry.lastError ?? "Tekrar denenecek.",
                showsFalseSuccess: false,
                messageId: entry.messageId
            )
        case WatchOutboundWireStatus.localPending:
            return WatchDisplayState(
                phase: .sending,
                headlineTr: "Hazırlanıyor",
                detailTr: "SOS hazırlanıyor.",
                showsFalseSuccess: false,
                messageId: entry.messageId
            )
        default:
            if ackFresh && entry.status != WatchOutboundWireStatus.phoneQueued {
                return stale(messageId: entry.messageId)
            }
            return idle()
        }
    }

    public static func idle() -> WatchDisplayState {
        WatchDisplayState(
            phase: .idle,
            headlineTr: "SOS",
            detailTr: "Acil durumda iki adımda onaylayın.",
            showsFalseSuccess: false
        )
    }

    private static func unreachable(messageId: String) -> WatchDisplayState {
        WatchDisplayState(
            phase: .phoneUnreachable,
            headlineTr: "Telefona ulaşılamıyor",
            detailTr: "SOS saatte bekletiliyor; gönderildi denmez.",
            showsFalseSuccess: false,
            messageId: messageId
        )
    }

    private static func stale(messageId: String) -> WatchDisplayState {
        WatchDisplayState(
            phase: .stale,
            headlineTr: "Durum güncel değil",
            detailTr: "Telefon bağlantısını kontrol edin.",
            showsFalseSuccess: false,
            messageId: messageId
        )
    }
}
