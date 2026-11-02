import SwiftUI
import SOSMeshCore

@MainActor
final class AppModel: ObservableObject {
    @Published var relayEnabled = false
    @Published var preferredRole: BlePeerRole = .sender
    @Published var acceptedDisclaimer = false
    @Published var highPowerRadioConsent = false
    @Published var restorationPhase: BleRestorationPhase = .coldStart
    @Published var outboxCount = 0
    @Published var platformHint: CrossPlatformUserHint = .none

    /// Preview / simulated fault injection for UX tests (not real GPS coordinates).
    @Published var simulateLocationUnavailable = false
    @Published var simulateTransferCorrupt = false
    @Published var simulateApiUploadFailed = false
    @Published var simulateBluetoothOff = false
    @Published var simulatePermissionsDenied = false

    private var restorationMachine = BleRestorationStateMachine()
    private let roleSelector = BleRoleSelector()

    func bootstrap() {
        if restorationPhase == .coldStart {
            restorationMachine = BleRestorationStateMachine()
            try? restorationMachine.apply(.appLaunched)
            restorationPhase = restorationMachine.phase
        }
    }

    func currentBleRoleDecision(pendingSos: Bool) -> (BlePeerRole, Bool, Bool) {
        let decision = roleSelector.resolve(
            preferredRole: preferredRole,
            relayToggleOn: relayEnabled,
            hasPendingLocalSos: pendingSos
        )
        return (decision.role, decision.scan, decision.advertise)
    }

    func noteEnteredBackground() {
        try? restorationMachine.apply(.didEnterBackground)
        restorationPhase = restorationMachine.phase
    }

    func noteEnteredForeground() {
        try? restorationMachine.apply(.willEnterForeground)
        restorationPhase = restorationMachine.phase
    }

    func refreshPlatformHint() {
        let state = CrossPlatformPlatformState(
            bluetoothEnabled: !simulateBluetoothOff,
            blePermissionsGranted: !simulatePermissionsDenied,
            locationAvailable: !simulateLocationUnavailable,
            networkValidated: false,
            batteryLevelPercent: 100,
            relayOptIn: relayEnabled,
            lastTransferCorrupt: simulateTransferCorrupt,
            lastApiUploadFailed: simulateApiUploadFailed
        )
        platformHint = CrossPlatformPlatformEvaluator.userHint(for: state)
    }
}
