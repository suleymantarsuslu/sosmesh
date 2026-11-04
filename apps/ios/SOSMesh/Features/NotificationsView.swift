import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject private var appModel: AppModel
    @ObservedObject private var historyStore = NotificationHistoryStore.shared
    @State private var expandedItemId: String?
    @State private var showClearConfirmation = false
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Group {
                if historyStore.items.isEmpty {
                    VStack(spacing: DesignSystem.Spacing.md) {
                        Spacer()
                        Text("notifications.empty")
                            .font(DesignSystem.Typography.body)
                            .foregroundStyle(DesignSystem.Colors.textSecondary)
                        Spacer()
                    }
                } else {
                    ScrollView {
                        VStack(spacing: DesignSystem.Spacing.xs) {
                            ForEach(historyStore.items) { item in
                                NotificationCard(
                                    item: item,
                                    isExpanded: expandedItemId == item.id,
                                    onTap: {
                                        handleItemTap(item)
                                    }
                                )
                            }
                        }
                        .padding(DesignSystem.Spacing.md)
                    }
                }
            }
            .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
            .navigationTitle("notifications.title")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .foregroundStyle(DesignSystem.Colors.accentBlue)
                    }
                }
                if !historyStore.items.isEmpty {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button {
                            showClearConfirmation = true
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(DesignSystem.Colors.accentBlue)
                        }
                    }
                }
            }
            .onAppear {
                historyStore.markAllRead()
            }
            .confirmationDialog(
                NSLocalizedString("notifications.clear.confirm", comment: ""),
                isPresented: $showClearConfirmation,
                titleVisibility: .visible
            ) {
                Button(NSLocalizedString("notifications.clear.yes", comment: ""), role: .destructive) {
                    historyStore.clearAll()
                }
                Button(NSLocalizedString("notifications.clear.cancel", comment: ""), role: .cancel) {}
            }
        }
    }
    
    private func handleItemTap(_ item: NotificationHistoryItem) {
        switch item.type {
        case .broadcast:
            if expandedItemId == item.id {
                expandedItemId = nil
            } else {
                expandedItemId = item.id
            }
        case .incomingSOS:
            dismiss()
            NotificationCenter.default.post(name: .navigateToRelayTab, object: nil)
        }
    }
}

struct NotificationCard: View {
    let item: NotificationHistoryItem
    let isExpanded: Bool
    let onTap: () -> Void
    
    var body: some View {
        SOSCard {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                        Text(item.title)
                            .font(DesignSystem.Typography.headline)
                            .foregroundStyle(DesignSystem.Colors.textPrimary)
                            .lineLimit(isExpanded ? nil : 1)
                        
                        if let severity = item.severity {
                            SeverityBadge(severity: severity)
                        }
                    }
                    
                    Spacer()
                    
                    Text(formatTimestamp(item.timestampMs))
                        .font(DesignSystem.Typography.caption1)
                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                }
                
                Text(item.body)
                    .font(DesignSystem.Typography.body)
                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                    .lineLimit(isExpanded ? nil : 2)
            }
        }
        .onTapGesture(perform: onTap)
    }
    
    private func formatTimestamp(_ timestampMs: Int64) -> String {
        let date = Date(timeIntervalSince1970: Double(timestampMs) / 1000.0)
        let now = Date()
        let diff = now.timeIntervalSince(date)
        let hours = Int(diff / 3600)
        let days = hours / 24
        
        if hours < 1 {
            let minutes = Int(diff / 60)
            return "\(minutes)m"
        } else if hours < 24 {
            return "\(hours)h"
        } else if days < 7 {
            return "\(days)d"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        }
    }
}

struct SeverityBadge: View {
    let severity: String
    
    var body: some View {
        Text(severity.uppercased())
            .font(DesignSystem.Typography.caption1)
            .padding(.horizontal, DesignSystem.Spacing.xs)
            .padding(.vertical, 2)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.xs)
                    .fill(backgroundColor)
            )
            .foregroundStyle(textColor)
    }
    
    private var backgroundColor: Color {
        switch severity.lowercased() {
        case "critical":
            return DesignSystem.Colors.emergencyRed.opacity(0.2)
        case "warning":
            return Color.orange.opacity(0.2)
        default:
            return DesignSystem.Colors.accentBlue.opacity(0.2)
        }
    }
    
    private var textColor: Color {
        switch severity.lowercased() {
        case "critical":
            return DesignSystem.Colors.emergencyRed
        case "warning":
            return Color.orange
        default:
            return DesignSystem.Colors.accentBlue
        }
    }
}
