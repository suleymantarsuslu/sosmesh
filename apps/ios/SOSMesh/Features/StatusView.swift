import SwiftUI

struct StatusView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            Group {
                if appModel.outboxCount == 0 {
                    ContentUnavailableView("status.empty", systemImage: "tray")
                } else {
                    List {
                        Label("status.timeline.1", systemImage: "1.circle")
                        Label("status.timeline.2", systemImage: "2.circle")
                    }
                }
                Text("status.disclaimer")
                    .font(.footnote)
                    .padding()
            }
            .navigationTitle("status.title")
        }
    }
}
