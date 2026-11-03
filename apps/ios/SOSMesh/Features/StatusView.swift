import SwiftUI
import SOSMeshCore
import SOSMeshContracts

struct StatusView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            Group {
                if appModel.outboxEntries.isEmpty {
                    emptyStateView
                } else {
                    ScrollView {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            ForEach(appModel.outboxEntries, id: \.sosId) { entry in
                                messageCard(entry: entry)
                            }
                        }
                        .padding(DesignSystem.Spacing.md)
                    }
                    .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
                }
            }
            .navigationTitle("status.title")
            .task { await appModel.reloadOutbox() }
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            Image(systemName: "tray")
                .font(.system(size: 64))
                .foregroundStyle(DesignSystem.Colors.textTertiary)
            Text("status.empty")
                .font(DesignSystem.Typography.title3)
                .foregroundStyle(DesignSystem.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
    }
    
    @ViewBuilder
    private func messageCard(entry: OutboxEntryMeta) -> some View {
        SOSCard {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                HStack {
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(DesignSystem.Colors.accentBlue)
                    Text(entry.sosId)
                        .font(DesignSystem.Typography.headline)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    timelineStep(
                        title: "status.timeline.1",
                        reached: hopReached(entry.state, "LOCAL_SAVED"),
                        isLast: false
                    )
                    timelineStep(
                        title: "status.timeline.2",
                        reached: hopReached(entry.state, "PEER_RECEIVED"),
                        isLast: true
                    )
                    .accessibilityHint(Text("status.peer_not_server"))
                }
                
                HStack(spacing: DesignSystem.Spacing.xxs) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 12))
                        .foregroundStyle(DesignSystem.Colors.textTertiary)
                    Text("status.disclaimer")
                        .font(DesignSystem.Typography.caption2)
                        .foregroundStyle(DesignSystem.Colors.textTertiary)
                }
            }
        }
    }
    
    @ViewBuilder
    private func timelineStep(title: LocalizedStringKey, reached: Bool, isLast: Bool) -> some View {
        HStack(spacing: DesignSystem.Spacing.xs) {
            ZStack {
                Circle()
                    .fill(reached ? DesignSystem.Colors.successGreen : DesignSystem.Colors.textTertiary.opacity(0.3))
                    .frame(width: 24, height: 24)
                
                if reached {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                } else {
                    Circle()
                        .fill(DesignSystem.Colors.textTertiary)
                        .frame(width: 8, height: 8)
                }
            }
            
            Text(title)
                .font(DesignSystem.Typography.callout)
                .foregroundStyle(reached ? DesignSystem.Colors.textPrimary : DesignSystem.Colors.textSecondary)
            
            Spacer()
            
            if reached {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(DesignSystem.Colors.successGreen)
            }
        }
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
