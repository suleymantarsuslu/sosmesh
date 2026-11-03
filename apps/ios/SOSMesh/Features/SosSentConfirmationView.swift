import SwiftUI
import Network

struct SosSentConfirmationView: View {
    @Environment(\.dismiss) private var dismiss
    let sosId: String
    let navigateToStatus: () -> Void
    
    @State private var isOnline = false
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 80))
                        .foregroundStyle(DesignSystem.Colors.successGreen)
                        .accessibilityHidden(true)
                    
                    Text("sos.sent.title")
                        .font(DesignSystem.Typography.largeTitle)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                        .accessibilityAddTraits(.isHeader)
                    
                    SOSCard {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                            HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                                Image(systemName: isOnline ? "network" : "externaldrive.fill")
                                    .font(.system(size: 24))
                                    .foregroundStyle(DesignSystem.Colors.accentBlue)
                                    .accessibilityHidden(true)
                                
                                Text(isOnline ? "sos.sent.online" : "sos.sent.offline")
                                    .font(DesignSystem.Typography.body)
                                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            
                            Divider()
                            
                            HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 20))
                                    .foregroundStyle(DesignSystem.Colors.emergencyRed)
                                    .accessibilityHidden(true)
                                
                                Text("sos.sent.not112")
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                            }
                        }
                    }
                    .accessibilityElement(children: .combine)
                    
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        PrimaryButton("sos.sent.action.ok", icon: "checkmark") {
                            navigateToStatus()
                            dismiss()
                        }
                        
                        Link(destination: URL(string: "tel:112")!) {
                            HStack(spacing: DesignSystem.Spacing.xs) {
                                Image(systemName: "phone.fill")
                                Text("gate.action.call112")
                            }
                            .font(DesignSystem.Typography.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, DesignSystem.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                                    .fill(DesignSystem.Colors.emergencyRed)
                            )
                        }
                        .accessibilityLabel(Text("gate.action.call112"))
                        .accessibilityHint(Text("gate.action.call112.hint"))
                    }
                }
                .padding(DesignSystem.Spacing.md)
            }
            .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        navigateToStatus()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(DesignSystem.Colors.textSecondary)
                    }
                    .accessibilityLabel(Text("Close"))
                }
            }
            .onAppear {
                checkNetworkStatus()
            }
        }
    }
    
    private func checkNetworkStatus() {
        let monitor = NWPathMonitor()
        let queue = DispatchQueue(label: "NetworkMonitor")
        monitor.pathUpdateHandler = { path in
            DispatchQueue.main.async {
                isOnline = path.status == .satisfied
            }
        }
        monitor.start(queue: queue)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            monitor.cancel()
        }
    }
}

struct PrimaryButton: View {
    let title: LocalizedStringKey
    let icon: String
    var isDestructive: Bool = false
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.sm) {
                Image(systemName: icon)
                Text(title)
            }
            .font(DesignSystem.Typography.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(
                        isDestructive
                            ? DesignSystem.Colors.emergencyRed
                            : DesignSystem.Colors.accentBlue
                    )
            )
        }
        .accessibilityLabel(Text(title))
    }
}
