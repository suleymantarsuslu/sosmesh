import SwiftUI
import UIKit
import SOSMeshCore
import SOSMeshContracts

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
    @Published var lastUploadToken: String?

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
    private let composer: IosSosMessageComposer?
    private let outboxStorePathOverride: String?
    private let meshRadioFactory: ((SosOutboxService, ReceivedSosInbox) -> BleMeshRadioPort)?
    private var outboxService: SosOutboxService?
    private let receivedInboxStore = ReceivedSosInbox()
    private var meshRadio: BleMeshRadioPort?
    private var meshTickTimer: Timer?
    private var ingestUploader: IngestUploader?
    private var uploadsInFlight = Set<String>()

    init(
        permissionProbe: AppPermissionProbing? = nil,
        outboxStorePath: String? = nil,
        meshRadioFactory: ((SosOutboxService, ReceivedSosInbox) -> BleMeshRadioPort)? = nil
    ) {
        let probe = permissionProbe ?? LiveAppPermissionProbe()
        self.permissionProbe = probe
        self.outboxStorePathOverride = outboxStorePath
        self.meshRadioFactory = meshRadioFactory
        self.composer = try? IosSosMessageComposer(cryptoConfig: SosCryptoConfiguration.loadComposerConfig())
        probe.onGateRefreshRequested = { [weak self] in
            Task { @MainActor in
                await self?.refreshPermissionGate()
            }
        }
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
        Task { await refreshPermissionGate() }
    }

    func onPermissionGateBecameVisible() {
        permissionProbe.primeBluetoothAuthorizationIfAlreadyAuthorized()
        Task { await refreshPermissionGate() }
    }

    func refreshPermissionGate() async {
        Task { await retryPendingServerUploads() }
        var snapshot = await permissionProbe.captureSnapshot()
        #if DEBUG
        if useFaultSimulationOverrides {
            snapshot = PermissionGateSnapshot(
                bluetoothAuthorization: simulatePermissionsDenied ? .denied : snapshot.bluetoothAuthorization,
                bluetoothPoweredOn: !simulateBluetoothOff,
                notificationAuthorization: simulatePermissionsDenied ? .denied : snapshot.notificationAuthorization
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
        }
        await refreshPermissionGate()
    }

    func submitSos(note: String, languageTag: String) async throws -> String {
        guard let composer else {
            throw SosCryptoConfigurationError.releaseEncryptionNotConfigured
        }
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
        
        if let sosMessageObject = try? JSONSerialization.jsonObject(with: composed.wirePayload) as? [String: Any] {
            let sosId = composed.message.id
            let digest = composed.digest
            let blob = composed.encryptedBlobBase64
            Task.detached { [weak self] in
                await self?.attemptServerUpload(
                    sosId: sosId,
                    digest: digest,
                    encryptedBlobBase64: blob,
                    sosMessage: sosMessageObject
                )
            }
        }
        
        _ = try? meshRadio?.connectFirstPeerIfNeeded()
        meshRadio?.tick(nowMs: nowMs)
        
        return composed.message.id
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
            locationAvailable: true,
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
        let path: String
        if let outboxStorePathOverride {
            path = outboxStorePathOverride
        } else {
            path = try OutboxStorePaths.applicationSupportOutboxFileURL().path
        }
        outboxService = try SosOutboxService(storePath: path, sourceRoot: root)
    }

    private func requireOutbox() throws -> SosOutboxService {
        try ensureOutbox()
        guard let outboxService else {
            throw NSError(domain: "AppModel", code: 1, userInfo: nil)
        }
        return outboxService
    }
    
    /// Re-attempts the online upload for own SOS entries still waiting in LOCAL_SAVED (launch / foreground).
    private func retryPendingServerUploads() async {
        guard let service = try? requireOutbox(),
              let entries = try? service.listEntries() else { return }
        for entry in entries where entry.state == "LOCAL_SAVED" && entry.origin == "ios" {
            guard !uploadsInFlight.contains(entry.sosId),
                  let data = Data(base64Encoded: entry.encryptedBlobBase64),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            uploadsInFlight.insert(entry.sosId)
            await attemptServerUpload(
                sosId: entry.sosId,
                digest: entry.digest,
                encryptedBlobBase64: entry.encryptedBlobBase64,
                sosMessage: object
            )
            uploadsInFlight.remove(entry.sosId)
        }
    }

    private func attemptServerUpload(
        sosId: String,
        digest: String,
        encryptedBlobBase64: String,
        sosMessage: [String: Any]
    ) async {
        if ingestUploader == nil {
            let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
            let config = IngestConfig.production(deviceId: deviceId)
            ingestUploader = IngestUploader(config: config)
        }
        
        guard let uploader = ingestUploader else { return }
        
        let result = await uploader.upload(
            sosId: sosId,
            digest: digest,
            encryptedBlobBase64: encryptedBlobBase64,
            sosMessageJson: sosMessage
        )
        
        switch result {
        case .success(let receipt):
            let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
            if let service = try? requireOutbox(),
               let entry = try? service.listEntries().first(where: { $0.sosId == sosId && $0.digest == digest }) {
                let wasPending = entry.state == "LOCAL_SAVED"
                _ = try? service.markServerAccepted(
                    sosId: sosId,
                    digest: digest,
                    fromState: entry.state,
                    nowMs: nowMs
                )
                await MainActor.run {
                    self.lastUploadToken = receipt.uploadToken
                    Task { await self.reloadOutbox() }
                    
                    if wasPending, UIApplication.shared.applicationState != .active {
                        Task {
                            await SosNotificationManager.shared.notifyServerAccepted(sosId: sosId)
                        }
                    }
                }
                
                if let uploadToken = receipt.uploadToken {
                    Task {
                        await self.processAttachmentUploads(sosId: sosId, uploadToken: uploadToken)
                    }
                }
            }
        case .noNetwork, .httpError, .invalidReceipt, .error:
            break
        }
    }
    
    private func processAttachmentUploads(sosId: String, uploadToken: String) async {
        guard let baseDir = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ).appendingPathComponent("sosmesh") else {
            return
        }
        
        guard let queue = try? AttachmentQueue(baseDir: baseDir) else {
            return
        }
        
        try? queue.setUploadToken(uploadToken, forSosId: sosId)
        
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        let config = IngestConfig.production(deviceId: deviceId)
        let coordinator = AttachmentUploadCoordinator(queue: queue, baseURL: config.baseURL)
        await coordinator.processSosAttachments(sosId: sosId)
    }

    private func sourceRoot() -> String {
        PhoneWatchCompanionBootstrap.resolveSourceRoot()
    }

    private func startMeshIfNeeded() async {
        guard meshRadio == nil else { return }
        guard let outbox = try? requireOutbox() else { return }
        if let meshRadioFactory {
            meshRadio = meshRadioFactory(outbox, receivedInboxStore)
        } else {
            meshRadio = LiveBleMeshRadio(outbox: outbox, inbox: receivedInboxStore)
        }
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

extension AppModel {
    static func preview(snapshot: PermissionGateSnapshot) -> AppModel {
        AppModel(permissionProbe: StubAppPermissionProbe(snapshot: snapshot))
    }
}
