import Foundation

public enum WatchCapabilitySupport: String, Codable, Sendable {
    case supported
    case tested
    case experimental
    case unsupported
}

public struct WatchCapabilityRow: Equatable, Sendable {
    public let id: String
    public let titleTr: String
    public let watchOS: WatchCapabilitySupport
    public let wearOS: WatchCapabilitySupport
    public let notesTr: String

    public init(
        id: String,
        titleTr: String,
        watchOS: WatchCapabilitySupport,
        wearOS: WatchCapabilitySupport,
        notesTr: String
    ) {
        self.id = id
        self.titleTr = titleTr
        self.watchOS = watchOS
        self.wearOS = wearOS
        self.notesTr = notesTr
    }
}

public enum WatchCapabilityMatrix {
    public static let offlineMeshRelayClaim = WatchCapabilityRow(
        id: "offline_mesh_relay",
        titleTr: "Saat → başka telefon BLE mesh",
        watchOS: .unsupported,
        wearOS: .unsupported,
        notesTr: "Telefon olmadan mesh rölesi iddiası devre dışı; fiziksel kanıt ayrı kapı."
    )

    public static let companionSos = WatchCapabilityRow(
        id: "companion_sos",
        titleTr: "Eşleşmiş telefona SOS",
        watchOS: .supported,
        wearOS: .supported,
        notesTr: "Yalnızca companion kanalı; operatör ACK saatten gösterilmez."
    )

    public static let offlineQueue = WatchCapabilityRow(
        id: "offline_queue",
        titleTr: "Telefon erişilemezken yerel kuyruk",
        watchOS: .supported,
        wearOS: .supported,
        notesTr: "«Telefona ulaşılamıyor»; sahte «gönderildi» yok."
    )

    public static let directHttpsIngest = WatchCapabilityRow(
        id: "direct_https",
        titleTr: "Saatin kendi LTE/Wi‑Fi ile HTTPS ingest",
        watchOS: .experimental,
        wearOS: .unsupported,
        notesTr: "Ayrı capability flag; production dışı."
    )

    public static let complicationQuickAction = WatchCapabilityRow(
        id: "complication",
        titleTr: "Komplikasyon / hızlı SOS",
        watchOS: .supported,
        wearOS: .experimental,
        notesTr: "WidgetKit yüzeyi; gerçek saat NOT_TESTED."
    )

    public static let all: [WatchCapabilityRow] = [
        companionSos,
        offlineQueue,
        complicationQuickAction,
        directHttpsIngest,
        offlineMeshRelayClaim,
    ]

    public static func phoneNotReachableCopy(language: String) -> (headline: String, detail: String) {
        if language == "en" {
            return (
                "Phone unreachable",
                "SOS is held on the watch; not marked as sent. The watch alone does not guarantee mesh delivery."
            )
        }
        return (
            "Telefona ulaşılamıyor",
            "SOS saatte bekletiliyor; gönderildi denmez. Saat tek başına mesh garantisi vermez."
        )
    }
}
