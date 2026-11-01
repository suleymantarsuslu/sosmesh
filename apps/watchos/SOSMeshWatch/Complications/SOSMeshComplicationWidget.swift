import SwiftUI
import WidgetKit

/// Timeline copy must stay aligned with `WatchCapabilityMatrix.phoneNotReachableCopy(language: "tr")`.
private enum WatchComplicationCopy {
    static let unreachableHeadline = "Telefona ulaşılamıyor"
}

struct SOSMeshComplicationEntry: TimelineEntry {
    let date: Date
    let headline: String
    let detail: String
}

struct SOSMeshComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> SOSMeshComplicationEntry {
        SOSMeshComplicationEntry(date: Date(), headline: "SOS", detail: "Onay gerekli")
    }

    func getSnapshot(in context: Context, completion: @escaping (SOSMeshComplicationEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SOSMeshComplicationEntry>) -> Void) {
        let entry = SOSMeshComplicationEntry(
            date: Date(),
            headline: "SOS",
            detail: WatchComplicationCopy.unreachableHeadline
        )
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900))))
    }
}

struct SOSMeshComplicationView: View {
    var entry: SOSMeshComplicationEntry

    var body: some View {
        VStack {
            Text(entry.headline)
                .font(.caption)
            Text(entry.detail)
                .font(.caption2)
        }
        .accessibilityElement(children: .combine)
    }
}

struct SOSMeshComplicationWidget: Widget {
    let kind = "SOSMeshSOSComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SOSMeshComplicationProvider()) { entry in
            SOSMeshComplicationView(entry: entry)
        }
        .configurationDisplayName("SOSMesh SOS")
        .description("Hızlı SOS kısayolu; iki adımlı onay uygulamada.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular])
    }
}
