import SwiftUI
import UIKit

struct HomeView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    headerSection
                    disclaimerCard
                    CrossPlatformFaultBanner(hint: appModel.platformHint, onOpenSettings: openSettings)
                    sosButtonSection
                    quickStatsCard
                }
                .padding(DesignSystem.Spacing.md)
            }
            .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: DesignSystem.Spacing.xs) {
                        Image("SOSMeshLogo")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(height: 32)
                            .accessibilityHidden(true)
                        Text("app.name")
                            .font(DesignSystem.Typography.headline)
                    }
                }
            }
            .task {
                await appModel.reloadOutbox()
            }
        }
    }
    
    private var headerSection: some View {
        VStack(spacing: DesignSystem.Spacing.xs) {
            Image("SOSMeshLogoLarge")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: 80)
                .accessibilityLabel(Text("app.name"))
            Text("app.tagline")
                .font(DesignSystem.Typography.title2)
                .foregroundStyle(DesignSystem.Colors.textPrimary)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, DesignSystem.Spacing.md)
    }
    
    private var disclaimerCard: some View {
        SOSCard {
            HStack(spacing: DesignSystem.Spacing.sm) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(DesignSystem.Colors.accentBlue)
                    .accessibilityHidden(true)
                Text("onboarding.not112")
                    .font(DesignSystem.Typography.callout)
                    .foregroundStyle(DesignSystem.Colors.textPrimary)
            }
        }
        .accessibilityLabel(Text("onboarding.not112"))
    }
    
    private var sosButtonSection: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            NavigationLink {
                SosSendView()
            } label: {
                HStack(spacing: DesignSystem.Spacing.sm) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 28, weight: .bold))
                    Text("sos.button.label")
                        .font(DesignSystem.Typography.largeTitle)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, DesignSystem.Spacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.lg)
                        .fill(
                            LinearGradient(
                                colors: [
                                    DesignSystem.Colors.emergencyRed,
                                    DesignSystem.Colors.emergencyRed.opacity(0.85)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
                .shadow(color: DesignSystem.Colors.emergencyRed.opacity(0.4), radius: 12, x: 0, y: 6)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("sos.button.label"))
            .accessibilityHint(Text("sos.button.aria"))
            
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
                        .fill(DesignSystem.Colors.accentBlue)
                )
            }
            .accessibilityLabel(Text("gate.action.call112"))
            .accessibilityHint(Text("gate.action.call112.hint"))
        }
    }
    
    private var quickStatsCard: some View {
        SOSCard {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                Label("status.title", systemImage: "chart.line.uptrend.xyaxis")
                    .font(DesignSystem.Typography.headline)
                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                
                if appModel.outboxCount > 0 {
                    HStack {
                        Image(systemName: "envelope.fill")
                            .foregroundStyle(DesignSystem.Colors.accentBlue)
                        Text("\(appModel.outboxCount) message\(appModel.outboxCount == 1 ? "" : "s") in outbox")
                            .font(DesignSystem.Typography.callout)
                            .foregroundStyle(DesignSystem.Colors.textSecondary)
                    }
                } else {
                    Text("status.empty")
                        .font(DesignSystem.Typography.callout)
                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                }
            }
        }
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

struct SosSendView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var note = ""
    @State private var sending = false
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: DesignSystem.Spacing.lg) {
                VStack(spacing: DesignSystem.Spacing.md) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(DesignSystem.Colors.emergencyRed)
                    
                    Text("sos.confirm.title")
                        .font(DesignSystem.Typography.largeTitle)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                    
                    Text("sos.confirm.message")
                        .font(DesignSystem.Typography.callout)
                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, DesignSystem.Spacing.lg)
                
                SOSCard {
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                        Text("sos.note.placeholder")
                            .font(DesignSystem.Typography.caption1)
                            .foregroundStyle(DesignSystem.Colors.textSecondary)
                        TextField("", text: $note, axis: .vertical)
                            .textFieldStyle(.plain)
                            .font(DesignSystem.Typography.body)
                            .lineLimit(3...6)
                    }
                }
                
                VStack(spacing: DesignSystem.Spacing.sm) {
                    PrimaryButton("sos.confirm.yes", icon: "paperplane.fill", isDestructive: true) {
                        Task { await send() }
                    }
                    .disabled(sending)
                    
                    if sending {
                        HStack(spacing: DesignSystem.Spacing.xs) {
                            ProgressView()
                                .tint(DesignSystem.Colors.accentBlue)
                            Text("Sending...")
                                .font(DesignSystem.Typography.callout)
                                .foregroundStyle(DesignSystem.Colors.textSecondary)
                        }
                        .padding(.vertical, DesignSystem.Spacing.sm)
                    }
                    
                    if let errorMessage {
                        SOSCard(highlighted: true) {
                            HStack(spacing: DesignSystem.Spacing.xs) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(DesignSystem.Colors.emergencyRed)
                                Text(errorMessage)
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                            }
                        }
                    }
                }
            }
            .padding(DesignSystem.Spacing.md)
        }
        .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
        .navigationTitle("sos.confirm.title")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func send() async {
        sending = true
        errorMessage = nil
        defer { sending = false }
        do {
            let lang = Locale.current.language.languageCode?.identifier ?? "en"
            try await appModel.submitSos(note: note, languageTag: lang)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
