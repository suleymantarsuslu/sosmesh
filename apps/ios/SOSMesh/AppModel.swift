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
    @Published private(set) var permissionGateStatus: PermissionGateStatus =
        .blocked(step: .bluetooth, reason: .notDetermined)
    @Published private(set) var outboxEntries: [OutboxEntryMeta] = []
    @Published private(set) var receivedInbox: [ReceivedSosRecord] = []

    /// Debug-only fault injection (not the default data path).
    #if DEBUG
    @Published var simulateLocationUnavailable = false
    @Published var simulateTransferCorrupt = false
    @Published var simulateApiUploadFailed = false
    @Published var simulateBluetoothOff = false
    @Published var simulatePermissionsDenied = false
    @Published var useFaultSimulationOverrides = false
    #endif

    private var restorationMachine = BleRestorationStateMachine()
    private let roleSelector = BleRoleSelector()
    private let permissionProbe: AppPermissionProbing
    private let composer = IosSosMessageComposer()
    private var outboxService: SosOutboxService?
    private let receivedInboxStore = ReceivedSosInbox()
    private var meshRadio: BleMeshRadioPort?
    private var meshTickTimer: Timer?

    init(permissionProbe: AppPermissionProbing = LiveAppPermissionProbe()) {
        self.permissionProbe = permissionProbe
    }

    var permissionGateCleared: Bool {
        PermissionGateEvaluator.isCleared(permissionGateStatus)
    }

    func bootstrap() {
        if restorationPhase == .coldStart {
            restorationMachine = BleRestorationStateMachine()
            try? restorationMachine.apply(.appLaunched)
            restorationPhase = restorationMachine.phase
        }
        permissionProbe.primeBluetoothAuthorization()
        Task { await refreshPermissionGate() }
    }

    func refreshPermissionGate() async {
        permissionProbe.primeBluetoothAuthorization()
        var snapshot = await permissionProbe.captureSnapshot()
        #if DEBUG
        if useFaultSimulationOverrides {
            snapshot = PermissionGateSnapshot(
                bluetoothAuthorization: simulatePermissionsDenied ? .denied : snapshot.bluetoothAuthorization,
                bluetoothPoweredOn: !simulateBluetoothOff,
                notificationAuthorization: simulatePermissionsDenied ? .denied : snapshot.notificationAuthorization,
                locationAuthorization: simulateLocationUnavailable ? .denied : snapshot.locationAuthorization
            )
        }
        #endif
        permissionGateStatus = PermissionGateEvaluator.evaluate(snapshot)
        refreshPlatformHint(from: snapshot)
        if permissionGateCleared {
            await startMeshIfNeeded()
        }
    }

    func requestPermissionForActiveGateStep() async {
        guard case .blocked(let step, let reason) = permissionGateStatus, reason == .notDetermined else {
            return
        }
        switch step {
        case .bluetooth:
            permissionProbe.primeBluetoothAuthorization()
        case .notifications:
            await permissionProbe.requestNotifications()
        case .location:
            permissionProbe.requestLocationWhenInUse()
        }
        await refreshPermissionGate()
    }

    func submitSos(note: String, languageTag: String) async throws {
        try ensureOutbox()
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        let composed = try composer.compose(
            IosSosComposeRequest(note: note, languageTag: languageTag, nowMs: nowMs)
        )
        let service = try requireOutbox()
        _ = try service.enqueueLocalSos(
            input: EnqueueInput(
                sosId: composed.message.id,
                digest: composed.digest,
                origin: "ios",
                encryptedBlobBase64: composed.encryptedBlobBase64
            ),
            nowMs: nowMs
        )
        await reloadOutbox()
        _ = try? meshRadio?.connectFirstPeerIfNeeded()
        meshRadio?.tick(nowMs: nowMs)
    }

    func reloadOutbox() async {
        guard let service = try? requireOutbox() else { return }
        let entries = (try? service.listEntries()) ?? []
        outboxEntries = entries
        outboxCount = entries.count
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
        Task { await refreshPermissionGate() }
    }

    private func refreshPlatformHint(from snapshot: PermissionGateSnapshot) {
        #if DEBUG
        if useFaultSimulationOverrides {
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
            return
        }
        #endif
        let state = CrossPlatformPlatformState(
            bluetoothEnabled: snapshot.bluetoothPoweredOn,
            blePermissionsGranted: snapshot.bluetoothAuthorization == .allowed,
            locationAvailable: snapshot.locationAuthorization == .whenInUse,
            networkValidated: false,
            batteryLevelPercent: 100,
            relayOptIn: relayEnabled,
            lastTransferCorrupt: false,
            lastApiUploadFailed: false
        )
        platformHint = CrossPlatformPlatformEvaluator.userHint(for: state)
    }

    private func ensureOutbox() throws {
        if outboxService != nil { return }
        let root = sourceRoot()
        let path = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("sosmesh-outbox-\(Bundle.main.bundleIdentifier ?? "ios").json")
            .path
        outboxService = try SosOutboxService(storePath: path, sourceRoot: root)
    }

    private func requireOutbox() throws -> SosOutboxService {
        try ensureOutbox()
        guard let outboxService else {
            throw NSError(domain: "AppModel", code: 1, userInfo: nil)
        }
        return outboxService
    }

    private func sourceRoot() -> String {
        PhoneWatchCompanionBootstrap.resolveSourceRoot()
    }

    private func startMeshIfNeeded() async {
        guard meshRadio == nil else { return }
        guard let outbox = try? requireOutbox() else { return }
        meshRadio = LiveBleMeshRadio(outbox: outbox, inbox: receivedInboxStore)
        let pending = outboxEntries.contains { $0.state == "LOCAL_SAVED" }
        let roleDecision = currentBleRoleDecision(pendingSos: pending)
        _ = meshRadio?.startDiscovery(
            role: roleDecision.0,
            relayEnabled: relayEnabled,
            pendingSos: pending
        )
        receivedInbox = receivedInboxStore.list()
        meshTickTimer?.invalidate()
        meshTickTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
                self.meshRadio?.tick(nowMs: nowMs)
                await self.reloadOutbox()
                self.receivedInbox = self.receivedInboxStore.list()
            }
        }
    }
}

#if DEBUG
extension AppModel {
    static func preview(snapshot: PermissionGateSnapshot) -> AppModel {
        AppModel(permissionProbe: StubAppPermissionProbe(snapshot: snapshot))
    }
}
#endif
