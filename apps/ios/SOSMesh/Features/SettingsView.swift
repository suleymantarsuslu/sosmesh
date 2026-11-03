import SwiftUI
import SOSMeshCore

struct SettingsView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            Form {
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
                    Text("Phase: \(appModel.restorationPhase.rawValue)")
                        .font(.caption)
                        .accessibilityLabel(Text("ios.restoration.phase"))
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
}

struct OnboardingDisclaimerView: View {
    let onAccept: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("onboarding.not112")
                    .font(.headline)
                Text("onboarding.experimental")
                Button("onboarding.accept") {
                    onAccept()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
        }
    }
}
