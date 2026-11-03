import SwiftUI
import UIKit
import SOSMeshCore

struct PermissionGateView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("gate.title")
                    .font(.title2)
                    .accessibilityAddTraits(.isHeader)
                Text("onboarding.not112")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                gateStepCard(
                    step: .bluetooth,
                    titleKey: "gate.step.bluetooth.title",
                    bodyKey: "gate.step.bluetooth.body",
                    isActive: activeStep == .bluetooth
                )
                gateStepCard(
                    step: .notifications,
                    titleKey: "gate.step.notifications.title",
                    bodyKey: "gate.step.notifications.body",
                    isActive: activeStep == .notifications
                )

                if case .blocked(let step, let reason) = appModel.permissionGateStatus {
                    statusBanner(step: step, reason: reason)
                }

                primaryActionButton
                if PermissionGateEvaluator.needsOpenSettings(appModel.permissionGateStatus) {
                    Button("gate.action.open_settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            openURL(url)
                        }
                    }
                    .buttonStyle(.bordered)
                    .accessibilityHint(Text("gate.action.open_settings.hint"))
                }

                Link(destination: URL(string: "tel:112")!) {
                    Text("gate.action.call112")
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
                .accessibilityLabel(Text("gate.action.call112"))
                .accessibilityHint(Text("gate.action.call112.hint"))
            }
            .padding()
        }
        .onAppear {
            appModel.refreshPermissionGate()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                appModel.refreshPermissionGate()
            }
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
                Text("gate.hint.bluetooth_off")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            case .notDetermined:
                Button(actionTitle(for: step)) {
                    Task { await appModel.requestPermissionForActiveGateStep() }
                }
                .buttonStyle(.borderedProminent)
            case .denied, .restricted, .unsupported:
                EmptyView()
            }
        }
    }

    private func actionTitle(for step: PermissionGateStep) -> LocalizedStringKey {
        switch step {
        case .bluetooth: return "gate.action.allow_bluetooth"
        case .notifications: return "gate.action.allow_notifications"
        }
    }

    @ViewBuilder
    private func gateStepCard(step: PermissionGateStep, titleKey: LocalizedStringKey, bodyKey: LocalizedStringKey, isActive: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(titleKey)
                .font(.headline)
            Text(bodyKey)
                .font(.body)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isActive ? Color.accentColor.opacity(0.12) : Color.gray.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func statusBanner(step: PermissionGateStep, reason: PermissionGateBlockReason) -> some View {
        switch reason {
        case .bluetoothPoweredOff:
            Label("gate.hint.bluetooth_off", systemImage: "antenna.radiowaves.left.and.right.slash")
                .foregroundStyle(.orange)
        case .denied, .restricted:
            Text("gate.hint.open_settings")
                .font(.footnote)
                .foregroundStyle(.orange)
        case .notDetermined:
            EmptyView()
        case .unsupported:
            Text("gate.hint.bluetooth_unsupported")
                .font(.footnote)
                .foregroundStyle(.red)
        }
    }
}
