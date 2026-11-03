import SwiftUI

struct RelayView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    headerSection
                    
                    SOSCard {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                            HStack {
                                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xxs) {
                                    Text("relay.toggle.on")
                                        .font(DesignSystem.Typography.headline)
                                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                                    Text("relay.description")
                                        .font(DesignSystem.Typography.callout)
                                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                
                                Spacer()
                                
                                Toggle("", isOn: $appModel.relayEnabled)
                                    .labelsHidden()
                                    .accessibilityLabel(Text("relay.toggle.aria"))
                            }
                        }
                    }
                    
                    SOSCard {
                        HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(DesignSystem.Colors.warningOrange)
                            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xxs) {
                                Text("relay.warning")
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                                Text("ios.limitation.relay_without_internet")
                                    .font(DesignSystem.Typography.footnote)
                                    .foregroundStyle(DesignSystem.Colors.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    
                    infoSection
                }
                .padding(DesignSystem.Spacing.md)
            }
            .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
            .navigationTitle("relay.title")
        }
    }
    
    private var headerSection: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: "dot.radiowaves.left.and.right")
                .font(.system(size: 48))
                .foregroundStyle(DesignSystem.Colors.accentBlue)
            Text("relay.title")
                .font(DesignSystem.Typography.title2)
                .foregroundStyle(DesignSystem.Colors.textPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, DesignSystem.Spacing.md)
    }
    
    private var infoSection: some View {
        SOSCard {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                HStack(spacing: DesignSystem.Spacing.xs) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(DesignSystem.Colors.accentBlue)
                    Text("relay.how_it_works")
                        .font(DesignSystem.Typography.headline)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                }
                Text("help.relay.body")
                    .font(DesignSystem.Typography.callout)
                    .foregroundStyle(DesignSystem.Colors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
