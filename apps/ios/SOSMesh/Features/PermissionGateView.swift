import SwiftUI
import UIKit
import SOSMeshCore

struct PermissionGateView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .center, spacing: DesignSystem.Spacing.lg) {
                headerSection
                disclaimerSection
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                    Text("gate.title")
                        .font(DesignSystem.Typography.title2)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                    
                    gateStepCard(
                        step: .bluetooth,
                        titleKey: "gate.step.bluetooth.title",
                        bodyKey: "gate.step.bluetooth.body",
                        icon: "antenna.radiowaves.left.and.right",
                        isActive: activeStep == .bluetooth
                    )
                    gateStepCard(
                        step: .notifications,
                        titleKey: "gate.step.notifications.title",
                        bodyKey: "gate.step.notifications.body",
                        icon: "bell.badge.fill",
                        isActive: activeStep == .notifications
                    )
                    gateStepCard(
                        step: .location,
                        titleKey: "gate.step.location.title",
                        bodyKey: "gate.step.location.body",
                        icon: "location.fill",
                        isActive: activeStep == .location
                    )
                }

                if case .blocked(let step, let reason) = appModel.permissionGateStatus {
                    statusBanner(step: step, reason: reason)
                }

                actionButtonsSection
            }
            .padding(DesignSystem.Spacing.md)
        }
        .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
        .onAppear {
            appModel.refreshPermissionGate()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                appModel.refreshPermissionGate()
            }
        }
    }
    
    private var headerSection: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            Image("SOSMeshLogoLarge")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: 80)
                .accessibilityLabel(Text("app.name"))
            Text("app.tagline")
                .font(DesignSystem.Typography.title3)
                .foregroundStyle(DesignSystem.Colors.textSecondary)
        }
        .padding(.top, DesignSystem.Spacing.md)
    }
    
    private var disclaimerSection: some View {
        SOSCard {
            HStack(spacing: DesignSystem.Spacing.sm) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(DesignSystem.Colors.accentBlue)
                    .accessibilityHidden(true)
                Text("onboarding.not112")
                    .font(DesignSystem.Typography.subheadline)
                    .foregroundStyle(DesignSystem.Colors.textPrimary)
            }
        }
    }
    
    private var actionButtonsSection: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            primaryActionButton
            
            if PermissionGateEvaluator.needsOpenSettings(appModel.permissionGateStatus) {
                SecondaryButton("gate.action.open_settings", icon: "gear") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        openURL(url)
                    }
                }
                .accessibilityHint(Text("gate.action.open_settings.hint"))
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
                        .fill(DesignSystem.Colors.accentBlue)
                )
            }
            .accessibilityLabel(Text("gate.action.call112"))
            .accessibilityHint(Text("gate.action.call112.hint"))
        }
    }

    private var activeStep: PermissionGateStep? {
        if case .blocked(let step, _) = appModel.permissionGateStatus {
            return step
        }
        return nil
    }

    @ViewBuilder
    private var primaryActionButton: some View {
        if case .blocked(let step, let reason) = appModel.permissionGateStatus {
            switch reason {
            case .bluetoothPoweredOff:
                SOSCard(highlighted: true) {
                    HStack(spacing: DesignSystem.Spacing.xs) {
                        Image(systemName: "antenna.radiowaves.left.and.right.slash")
                            .foregroundStyle(DesignSystem.Colors.warningOrange)
                        Text("gate.hint.bluetooth_off")
                            .font(DesignSystem.Typography.callout)
                            .foregroundStyle(DesignSystem.Colors.textPrimary)
                    }
                }
            case .notDetermined:
                PrimaryButton(actionTitle(for: step), icon: stepIcon(for: step)) {
                    Task { await appModel.requestPermissionForActiveGateStep() }
                }
            case .denied, .restricted, .unsupported:
                EmptyView()
            }
        }
    }
    
    private func stepIcon(for step: PermissionGateStep) -> String {
        switch step {
        case .bluetooth: return "antenna.radiowaves.left.and.right"
        case .notifications: return "bell.badge.fill"
        case .location: return "location.fill"
        }
    }

    private func actionTitle(for step: PermissionGateStep) -> LocalizedStringKey {
        switch step {
        case .bluetooth: return "gate.action.allow_bluetooth"
        case .notifications: return "gate.action.allow_notifications"
        case .location: return "gate.action.allow_location"
        }
    }

    @ViewBuilder
    private func gateStepCard(step: PermissionGateStep, titleKey: LocalizedStringKey, bodyKey: LocalizedStringKey, icon: String, isActive: Bool) -> some View {
        SOSCard(highlighted: isActive) {
            HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundStyle(isActive ? DesignSystem.Colors.accentBlue : DesignSystem.Colors.textSecondary)
                    .frame(width: 32)
                    .accessibilityHidden(true)
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xxs) {
                    Text(titleKey)
                        .font(DesignSystem.Typography.headline)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                    Text(bodyKey)
                        .font(DesignSystem.Typography.callout)
                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func statusBanner(step: PermissionGateStep, reason: PermissionGateBlockReason) -> some View {
        switch reason {
        case .bluetoothPoweredOff:
            EmptyView()
        case .denied, .restricted:
            SOSCard(highlighted: true) {
                HStack(spacing: DesignSystem.Spacing.xs) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(DesignSystem.Colors.warningOrange)
                    Text("gate.hint.open_settings")
                        .font(DesignSystem.Typography.callout)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                }
            }
        case .notDetermined:
            EmptyView()
        case .unsupported:
            SOSCard(highlighted: true) {
                HStack(spacing: DesignSystem.Spacing.xs) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(DesignSystem.Colors.emergencyRed)
                    Text("gate.hint.bluetooth_unsupported")
                        .font(DesignSystem.Typography.callout)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                }
            }
        }
    }
}
