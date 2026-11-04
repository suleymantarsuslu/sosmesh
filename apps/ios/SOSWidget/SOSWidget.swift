import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        let entry = SimpleEntry(date: Date())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let entry = SimpleEntry(date: Date())
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
}

struct SOSWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            Color(red: 0.11, green: 0.11, blue: 0.12)
            
            VStack(spacing: 8) {
                if family == .systemSmall {
                    Spacer()
                    Text(NSLocalizedString("widget.app_name", comment: ""))
                        .font(.system(size: 10))
                        .foregroundColor(Color(red: 0.56, green: 0.56, blue: 0.58))
                    
                    Text("SOS")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                } else {
                    Text("SOS")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(red: 0.86, green: 0.21, blue: 0.27))
            )
            .padding(8)
        }
        .widgetURL(URL(string: "sosmesh://sos"))
    }
}

struct SOSWidget: Widget {
    let kind: String = "SOSWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            SOSWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(NSLocalizedString("widget.config_name", comment: ""))
        .description(NSLocalizedString("widget.description", comment: ""))
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}

struct SOSWidget_Previews: PreviewProvider {
    static var previews: some View {
        SOSWidgetEntryView(entry: SimpleEntry(date: Date()))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
    }
}
