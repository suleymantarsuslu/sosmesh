import SwiftUI
import SOSMeshCore

struct SettingsView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            Form {
                Section("settings.language.title") {
                    Button {
                        openLanguageSettings()
                    } label: {
                        HStack {
                            Text("settings.language.change")
                                .foregroundStyle(DesignSystem.Colors.textPrimary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(DesignSystem.Colors.textSecondary)
                        }
                    }
                    .accessibilityHint(Text("settings.language.change_hint"))
                }
                
                Section("settings.permissions.title") {
                    Text("settings.permissions.bluetooth")
                    Text("settings.permissions.location")
                }
                Section("settings.radio.title") {
                    Text("settings.radio.high_power_intro")
                        .font(.caption)
                    Toggle("settings.radio.high_power_consent", isOn: $appModel.highPowerRadioConsent)
                }
                Section("ios.background.section") {
                    Text("ios.limitation.background")
                    Text("ios.limitation.force_quit")
                    Text("\(Text("settings.ble_phase")): \(appModel.restorationPhase.rawValue)")
                        .font(.caption)
                        .accessibilityLabel(Text("settings.ble_phase"))
                }
                Section("settings.multihop.title") {
                    Toggle(isOn: Binding(
                        get: { MeshRelayFeatureFlags.isExperimentalMultihopRelayEnabled },
                        set: { MeshRelayFeatureFlags.setExperimentalMultihopRelayEnabled($0) }
                    )) {
                        Text("settings.multihop.toggle")
                    }
                    .accessibilityLabel(Text("settings.multihop.toggle"))
                    Text("settings.multihop.footer")
                        .font(.footnote)
                }
                #if DEBUG
                Section("settings.debug.fault_simulation") {
                    Toggle("settings.debug.use_fault_simulation", isOn: $appModel.useFaultSimulationOverrides)
                        .onChange(of: appModel.useFaultSimulationOverrides) { _, _ in
                            Task { await appModel.refreshPermissionGate() }
                        }
                    Toggle("settings.debug.simulate_bluetooth_off", isOn: $appModel.simulateBluetoothOff)
                    Toggle("settings.debug.simulate_permissions_denied", isOn: $appModel.simulatePermissionsDenied)
                    Toggle("settings.debug.simulate_location_unavailable", isOn: $appModel.simulateLocationUnavailable)
                }
                #endif
            }
            .navigationTitle("settings.title")
        }
    }
    
    private func openLanguageSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

struct OnboardingDisclaimerView: View {
    let onAccept: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: DesignSystem.Spacing.xl) {
                VStack(spacing: DesignSystem.Spacing.md) {
                    Image("SOSMeshLogoLarge")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(height: 100)
                        .accessibilityLabel(Text("app.name"))
                    
                    Text("app.name")
                        .font(DesignSystem.Typography.largeTitle)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                    
                    Text("app.tagline")
                        .font(DesignSystem.Typography.title3)
                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, DesignSystem.Spacing.xxl)
                
                VStack(spacing: DesignSystem.Spacing.md) {
                    SOSCard {
                        HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(DesignSystem.Colors.warningOrange)
                            Text("onboarding.not112")
                                .font(DesignSystem.Typography.headline)
                                .foregroundStyle(DesignSystem.Colors.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    
                    SOSCard {
                        HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                            Image(systemName: "flask.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(DesignSystem.Colors.accentBlue)
                            Text("onboarding.experimental")
                                .font(DesignSystem.Typography.callout)
                                .foregroundStyle(DesignSystem.Colors.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                
                PrimaryButton("onboarding.accept", icon: "checkmark") {
                    onAccept()
                }
                .padding(.top, DesignSystem.Spacing.md)
            }
            .padding(DesignSystem.Spacing.md)
        }
        .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
    }
}
