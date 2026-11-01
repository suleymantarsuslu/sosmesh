import SwiftUI
import SOSMeshCore

@MainActor
final class AppModel: ObservableObject {
    @Published var relayEnabled = false
    @Published var preferredRole: BlePeerRole = .sender
    @Published var acceptedDisclaimer = false
    @Published var restorationPhase: BleRestorationPhase = .coldStart
    @Published var outboxCount = 0

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
}
