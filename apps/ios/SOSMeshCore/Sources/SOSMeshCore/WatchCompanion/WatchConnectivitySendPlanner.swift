import Foundation

public enum WatchConnectivityPhase: String, Equatable, Sendable {
    case notPaired
    case sessionInactive
    case phoneUnreachable
    case phoneReachableImmediate
    case phoneReachableBackground
    case watchLocked
}

public enum WatchConnectivitySendMode: String, Equatable, Sendable {
    case none
    case sendMessage
    case transferUserInfo
}

public struct WatchConnectivitySnapshot: Equatable, Sendable {
    public let phase: WatchConnectivityPhase
    public let sendMode: WatchConnectivitySendMode
    public let userHeadlineTr: String
    public let userDetailTr: String

    public init(
        phase: WatchConnectivityPhase,
        sendMode: WatchConnectivitySendMode,
        userHeadlineTr: String,
        userDetailTr: String
    ) {
        self.phase = phase
        self.sendMode = sendMode
        self.userHeadlineTr = userHeadlineTr
        self.userDetailTr = userDetailTr
    }
}

/// Pure connectivity planner for WatchConnectivity send policy (testable without WCSession).
public enum WatchConnectivitySendPlanner {
    public static func snapshot(
        isPaired: Bool,
        sessionActivated: Bool,
        isReachable: Bool,
        isCompanionAppInstalled: Bool,
        watchLocked: Bool,
        lowPowerMode: Bool
    ) -> WatchConnectivitySnapshot {
        if !isPaired {
            return WatchConnectivitySnapshot(
                phase: .notPaired,
                sendMode: .none,
                userHeadlineTr: "Eşleşmiş iPhone gerekli",
                userDetailTr: "Saat tek başına mesh garantisi vermez."
            )
        }
        if watchLocked {
            return WatchConnectivitySnapshot(
                phase: .watchLocked,
                sendMode: .transferUserInfo,
                userHeadlineTr: "Saat kilitli",
                userDetailTr: "SOS kuyruğa alınır; telefon açılınca iletilir."
            )
        }
        if !sessionActivated {
            return WatchConnectivitySnapshot(
                phase: .sessionInactive,
                sendMode: .none,
                userHeadlineTr: "Bağlantı hazırlanıyor",
                userDetailTr: "Watch Connectivity etkinleşene kadar bekleyin."
            )
        }
        if !isCompanionAppInstalled {
            return WatchConnectivitySnapshot(
                phase: .phoneUnreachable,
                sendMode: .transferUserInfo,
                userHeadlineTr: "Telefona ulaşılamıyor",
                userDetailTr: "iPhone uygulaması yüklü değil veya erişilemiyor."
            )
        }
        if isReachable && !lowPowerMode {
            return WatchConnectivitySnapshot(
                phase: .phoneReachableImmediate,
                sendMode: .sendMessage,
                userHeadlineTr: "Telefon erişilebilir",
                userDetailTr: "Anlık iletim denenecek."
            )
        }
        return WatchConnectivitySnapshot(
            phase: .phoneReachableBackground,
            sendMode: .transferUserInfo,
            userHeadlineTr: lowPowerMode ? "Düşük güç modu" : "Telefona ulaşılamıyor",
            userDetailTr: "SOS arka planda kuyruğa alınır; gönderildi denmez."
        )
    }

    public static func isPhoneReachableForQueue(snapshot: WatchConnectivitySnapshot) -> Bool {
        snapshot.phase == .phoneReachableImmediate
    }
}
