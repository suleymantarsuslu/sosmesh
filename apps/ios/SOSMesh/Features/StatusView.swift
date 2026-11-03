import SwiftUI
import SOSMeshCore
import SOSMeshContracts

struct StatusView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            Group {
                if appModel.outboxEntries.isEmpty {
                    ContentUnavailableView("status.empty", systemImage: "tray")
                } else {
                    List(appModel.outboxEntries, id: \.sosId) { entry in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(entry.sosId)
                                .font(.headline)
                            timelineRow(entry: entry)
                            Text("status.disclaimer")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("status.title")
            .task { await appModel.reloadOutbox() }
        }
    }

    @ViewBuilder
    private func timelineRow(entry: OutboxEntryMeta) -> some View {
        Label("status.timeline.1", systemImage: hopReached(entry.state, "LOCAL_SAVED") ? "checkmark.circle.fill" : "1.circle")
        Label("status.timeline.2", systemImage: hopReached(entry.state, "PEER_RECEIVED") ? "checkmark.circle.fill" : "2.circle")
            .accessibilityHint(Text("status.peer_not_server"))
    }

    private func hopReached(_ current: String, _ hop: String) -> Bool {
        let order = ["LOCAL_SAVED", "PEER_RECEIVED", "SERVER_ACCEPTED"]
        guard let currentIndex = order.firstIndex(of: current),
              let hopIndex = order.firstIndex(of: hop)
        else {
            return current == hop
        }
        return currentIndex >= hopIndex
    }
}
