import SwiftUI
import UIKit
import CoreLocation
import SOSMeshCore
import SOSMeshContracts

@MainActor
final class AppModel: ObservableObject {
    /// Persisted: relay mode survives restarts and takes effect immediately on the radio.
    @Published var relayEnabled: Bool {
        didSet {
            guard relayEnabled != oldValue else { return }
            defaults.set(relayEnabled, forKey: AppModel.relayEnabledDefaultsKey)
            meshNode?.relayEnabled = relayEnabled
            restartDiscoveryForCurrentMode()
        }
    }
    @Published var preferredRole: BlePeerRole = .sender
    @Published var acceptedDisclaimer = false
    @Published var highPowerRadioConsent = false
    @Published var restorationPhase: BleRestorationPhase = .coldStart
    @Published var outboxCount = 0
    @Published var platformHint: CrossPlatformUserHint = .none
    @Published private(set) var permissionGateStatus: PermissionGateStatus =
        .blocked(step: .bluetooth, reason: .notDetermined)
    @Published private(set) var outboxEntries: [OutboxEntryMeta] = []
    @Published private(set) var receivedInbox: [ReceivedSosRecord] = [] {
        didSet {
            handleReceivedInboxChange(old: oldValue, new: receivedInbox)
        }
    }
    @Published var lastUploadToken: String?
    @Published private(set) var relayDiagnostics = RelayDiagnosticsSnapshot()
    @Published var showDeliveredModal = false
    @Published var deliveredModalSosId: String?

    let deliveredModalTracker = DeliveredModalTracker()
    let openCaseTracker = OpenCaseTracker()
    let relayCounter = RelayDeliveryCounter()

    /// Debug-only fault injection (not the default data path).
    #if DEBUG
    @Published var simulateLocationUnavailable = false
    @Published var simulateTransferCorrupt = false
    @Published var simulateApiUploadFailed = false
    @Published var simulateBluetoothOff = false
    @Published var simulatePermissionsDenied = false
    @Published var useFaultSimulationOverrides = false
    #endif

    static let relayEnabledDefaultsKey = "sosmesh.relay.enabled"

    private let defaults: UserDefaults
    private let diagnostics = RelayDiagnostics()
    private var relayForwarder: RelayForwarder?
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
    private let locationManager = SosLocationManager()
    private var uploadsInFlight = Set<String>()
    private var attachmentCoordinator: AttachmentUploadCoordinator?
    private var attachmentQueue: AttachmentQueue?
    private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid
    /// Mesh v2 state (docs/protocol/mesh-v2.md).
    private(set) var meshNode: MeshV2Node?
    private var gatewayProbe: GatewayProbe?
    private var lastMeshPurgeMs: Int64 = 0
    private var lastOwnUploadAttemptMs: [String: Int64] = [:]
    private var profileSentThisSession = false
    let identityStore = SosIdentityStore()
    @Published var lastSubmitPlan: SosRateLimiter.Plan = .sendNow
    private var broadcastRepository: BroadcastRepository?
    private var broadcastNotificationManager: BroadcastNotificationManager?
    private var pushTokenManager: PushTokenManager?
    private var broadcastPollingTask: Task<Void, Never>?

    init(
        permissionProbe: AppPermissionProbing? = nil,
        outboxStorePath: String? = nil,
        meshRadioFactory: ((SosOutboxService, ReceivedSosInbox) -> BleMeshRadioPort)? = nil,
        defaults: UserDefaults = .standard
    ) {
        self.defaults = defaults
        self.relayEnabled = defaults.bool(forKey: AppModel.relayEnabledDefaultsKey)
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
        permissionProbe.primeBluetoothAuthorizationIfAlreadyAuthorized()
        initializeAttachmentCoordinator()
        initializeBroadcasts()
        registerForRemoteNotifications()
        startBroadcastPolling()
        Task {
            await refreshPermissionGate()
            await fetchAndNotifyBroadcasts()
        }
    }

    func enableRelay() async {
        relayEnabled = true
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
        
        let location = await locationManager.requestLocationAsync(timeoutMs: 2000)
        
        openCaseTracker.openCase(sosId: "", nowMs: nowMs)
        
        let service = try requireOutbox()
        // Client rate limit (§8.1): never refuses. Replace an SOS that never left the device,
        // otherwise queue the new one until the window opens.
        let ownEntries = ((try? service.listEntries()) ?? []).filter { $0.origin != SosOutboxService.relayOrigin }
        let plan = SosRateLimiter.plan(ownEntries: ownEntries, nowMs: nowMs)
        var releaseAtMs = nowMs
        switch plan {
        case .sendNow:
            break
        case .replace(let oldId, let oldDigest):
            if let old = ownEntries.first(where: { $0.sosId == oldId && $0.digest == oldDigest }) {
                releaseAtMs = max(nowMs, old.retryAtMs)
            }
            _ = try? service.removeEntry(sosId: oldId, digest: oldDigest)
        case .queueUntil(let at):
            releaseAtMs = at
        }
        lastSubmitPlan = plan

        let profile = identityStore.loadProfile()
        let changed = profile.map { identityStore.profileChanged($0) } ?? false
        let includeProfile = profile != nil && (changed || !profileSentThisSession)
        let context = SosInnerV2Context(
            senderKey: identityStore.senderKey(),
            seq: identityStore.nextSeq(),
            profile: includeProfile ? profile : nil,
            profileChanged: changed
        )
        let composed = try composer.compose(
            IosSosComposeRequest(note: note, languageTag: languageTag, nowMs: nowMs, location: location, innerV2: context)
        )
        if includeProfile, let profile {
            profileSentThisSession = true
            identityStore.markProfileSent(profile)
        }
        _ = try service.enqueueLocalSos(
            input: EnqueueInput(
                sosId: composed.message.id,
                digest: composed.digest,
                origin: "ios",
                encryptedBlobBase64: composed.encryptedBlobBase64
            ),
            nowMs: nowMs
        )
        if releaseAtMs > nowMs {
            try? service.setRetryAt(sosId: composed.message.id, digest: composed.digest, retryAtMs: releaseAtMs, lastError: "rate_limited_queued")
            await reloadOutbox()
            return composed.message.id
        }
        openCaseTracker.openCase(sosId: composed.message.id, nowMs: nowMs)
        
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

    // MARK: Profile (Keychain only)

    func loadProfile() -> SosProfile? { identityStore.loadProfile() }

    func saveProfile(_ profile: SosProfile) {
        identityStore.saveProfile(profile)
    }

    func deleteProfile() {
        identityStore.deleteProfile()
    }

    func currentCoordinate() async -> SosProfile.Coordinate? {
        let snapshot = await locationManager.requestLocationAsync(timeoutMs: 5000)
        guard let lat = snapshot.latitude, let lng = snapshot.longitude else { return nil }
        return SosProfile.Coordinate(latitude: lat, longitude: lng)
    }

    func reloadOutbox() async {
        guard let service = try? requireOutbox() else { return }
        // Envelopes held for other phones (origin `relay`) are not the user's own SOS history.
        let entries = ((try? service.listEntries()) ?? []).filter { $0.origin != SosOutboxService.relayOrigin }
        outboxEntries = entries
        outboxCount = entries.count
    }

    func currentBleRoleDecision(pendingSos: Bool) -> (BlePeerRole, Bool, Bool) {
        let decision = roleSelector.resolve(
            preferredRole: preferredRole,
            relayToggleOn: relayEnabled,
            hasPendingLocalSos: pendingSos
        )
        // Relay mode keeps the GATT server + advertising on even while an own SOS is pending,
        // otherwise a relay phone with its own SOS would stop being reachable by nearby senders.
        return (decision.role, decision.scan, decision.advertise || relayEnabled)
    }

    func noteEnteredBackground() {
        try? restorationMachine.apply(.didEnterBackground)
        restorationPhase = restorationMachine.phase
        stopBroadcastPolling()
    }

    func noteEnteredForeground() {
        try? restorationMachine.apply(.willEnterForeground)
        restorationPhase = restorationMachine.phase
        startBroadcastPolling()
        Task {
            await refreshPermissionGate()
            await attachmentCoordinator?.processQueue()
            await fetchAndNotifyBroadcasts()
        }
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
        // PEER_RECEIVED is only a nearby-phone ACK: once online the own upload still runs
        // (the server de-duplicates a packet a relay already forwarded).
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        for entry in MeshUploadOrdering.ordered(entries) where entry.origin == "ios" {
            let needsUpload = (entry.state == "LOCAL_SAVED" || entry.state == "PEER_RECEIVED") ||
                              (entry.state == "SERVER_ACCEPTED" && hasPendingAttachmentsWithoutToken(sosId: entry.sosId))
            guard needsUpload,
                  entry.retryAtMs <= nowMs,
                  nowMs - (lastOwnUploadAttemptMs[entry.sosId] ?? 0) >= 30_000,
                  !uploadsInFlight.contains(entry.sosId),
                  let data = Data(base64Encoded: entry.encryptedBlobBase64),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            uploadsInFlight.insert(entry.sosId)
            lastOwnUploadAttemptMs[entry.sosId] = nowMs
            await attemptServerUpload(
                sosId: entry.sosId,
                digest: entry.digest,
                encryptedBlobBase64: entry.encryptedBlobBase64,
                sosMessage: object
            )
            uploadsInFlight.remove(entry.sosId)
        }
    }
    
    private func hasPendingAttachmentsWithoutToken(sosId: String) -> Bool {
        guard let queue = attachmentQueue else { return false }
        let attachments = queue.listBySosId(sosId)
        return attachments.contains { $0.uploadToken == nil }
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
        
        // Own SOS: hopCount 0 (mesh v2 §9).
        let result = await uploader.upload(
            sosId: sosId,
            digest: digest,
            encryptedBlobBase64: encryptedBlobBase64,
            sosMessageJson: sosMessage,
            hopCount: 0
        )
        
        switch result {
        case .success(let receipt):
            let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
            meshNode?.hops.noteInternetSuccess(nowMs: nowMs)
            // Keeps the receipt as a tombstone so carriers of this SOS can drop their copies.
            meshNode?.recordServerReceipt(receipt, nowMs: nowMs)
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
                    
                    if wasPending {
                        if UIApplication.shared.applicationState != .active {
                            Task {
                                await SosNotificationManager.shared.notifyServerAccepted(sosId: sosId)
                            }
                        } else if self.deliveredModalTracker.shouldShowModal(for: sosId) {
                            self.deliveredModalSosId = sosId
                            self.showDeliveredModal = true
                            self.deliveredModalTracker.markModalShown(for: sosId)
                        }
                    }
                }
                
                if let uploadToken = receipt.uploadToken {
                    Task {
                        await self.processAttachmentUploads(sosId: sosId, uploadToken: uploadToken)
                    }
                }
            }
        case .noNetwork:
            meshNode?.hops.noteInternetFailure()
        case .httpError(let code, _, let retryAfterSeconds):
            meshNode?.hops.noteInternetSuccess(nowMs: Int64(Date().timeIntervalSince1970 * 1000))
            if (code == 429 || code == 503), let retryAfter = retryAfterSeconds, let service = try? requireOutbox() {
                let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
                let retryAtMs = nowMs + Int64(retryAfter * 1000)
                _ = try? service.setRetryAt(sosId: sosId, digest: digest, retryAtMs: retryAtMs, lastError: "rate_limited_\(code)")
                await reloadOutbox()
            }
        case .invalidReceipt, .error:
            break
        }
    }
    
    private func initializeAttachmentCoordinator() {
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
        
        self.attachmentQueue = queue
        
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        let config = IngestConfig.production(deviceId: deviceId)
        let coordinator = AttachmentUploadCoordinator(queue: queue, baseURL: config.baseURL)
        self.attachmentCoordinator = coordinator
        
        coordinator.start()
    }

    private func initializeBroadcasts() {
        let config = IngestConfig.production(deviceId: "")
        guard let publicKey = Bundle.main.object(forInfoDictionaryKey: "SOSMeshBroadcastPublicKey") as? String,
              let repository = try? BroadcastRepository(apiBaseUrl: config.baseURL, publicKeyBase64: publicKey) else {
            return
        }
        self.broadcastRepository = repository
        self.broadcastNotificationManager = BroadcastNotificationManager()
        self.pushTokenManager = PushTokenManager(apiBaseUrl: config.baseURL)
    }
    
    private func registerForRemoteNotifications() {
        Task { @MainActor in
            await UIApplication.shared.registerForRemoteNotifications()
        }
    }
    
    func didRegisterForRemoteNotifications(token: Data) {
        guard let pushTokenManager = pushTokenManager else { return }
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        Task {
            await pushTokenManager.registerToken(token, deviceId: deviceId)
        }
    }
    
    func didReceiveRemoteNotification(userInfo: [AnyHashable: Any]) {
        if userInfo["broadcastId"] != nil {
            Task {
                await fetchAndNotifyBroadcasts()
            }
        }
    }
    
    private func startBroadcastPolling() {
        broadcastPollingTask?.cancel()
        broadcastPollingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 20_000_000_000)
                if !Task.isCancelled {
                    await fetchAndNotifyBroadcasts()
                }
            }
        }
    }
    
    private func stopBroadcastPolling() {
        broadcastPollingTask?.cancel()
        broadcastPollingTask = nil
    }

    private func fetchAndNotifyBroadcasts() async {
        guard let repository = broadcastRepository,
              let notificationManager = broadcastNotificationManager else {
            return
        }
        let location = await locationManager.requestLocationAsync(timeoutMs: 2000)
        let clLocation = location.latitude != nil && location.longitude != nil
            ? CLLocation(latitude: location.latitude!, longitude: location.longitude!)
            : nil
        guard let broadcasts = try? await repository.fetchAndProcessBroadcasts(currentLocation: clLocation) else {
            return
        }
        
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        for broadcast in broadcasts {
            await notificationManager.showNotification(broadcast: broadcast)
            
            let historyItem = NotificationHistoryItem(
                id: broadcast.id,
                type: .broadcast,
                title: broadcast.title,
                body: broadcast.body,
                severity: broadcast.severity,
                regionName: nil,
                sosId: nil,
                timestampMs: nowMs,
                isRead: false
            )
            NotificationHistoryStore.shared.addItem(historyItem)
            
            if let meshNode = meshNode {
                let meshBroadcast = ServerBroadcast(
                    id: broadcast.id,
                    title: broadcast.title,
                    body: broadcast.body,
                    severity: broadcast.severity,
                    createdAt: broadcast.createdAt,
                    expiresAt: broadcast.expiresAt,
                    regionLat: broadcast.regionLat,
                    regionLng: broadcast.regionLng,
                    regionRadiusKm: broadcast.regionRadiusKm,
                    signature: broadcast.signature,
                    hopsLeft: 8
                )
                _ = meshNode.broadcasts.put(meshBroadcast, receivedAtMs: nowMs)
            }
        }
    }
    
    private func processAttachmentUploads(sosId: String, uploadToken: String) async {
        guard let queue = attachmentQueue else {
            return
        }
        
        try? queue.setUploadToken(uploadToken, forSosId: sosId)
        
        beginBackgroundTask()
        await attachmentCoordinator?.processSosAttachments(sosId: sosId)
        endBackgroundTask()
    }
    
    private func beginBackgroundTask() {
        guard backgroundTaskId == .invalid else { return }
        
        backgroundTaskId = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
    }
    
    private func endBackgroundTask() {
        guard backgroundTaskId != .invalid else { return }
        
        UIApplication.shared.endBackgroundTask(backgroundTaskId)
        backgroundTaskId = .invalid
    }

    private func sourceRoot() -> String {
        PhoneWatchCompanionBootstrap.resolveSourceRoot()
    }

    private func startMeshIfNeeded() async {
        guard meshRadio == nil else { return }
        guard let outbox = try? requireOutbox() else { return }
        let config = IngestConfig.production(deviceId: "")
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        let meshDirectory = try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("sosmesh", isDirectory: true)
        if let meshDirectory { try? FileManager.default.createDirectory(at: meshDirectory, withIntermediateDirectories: true) }
        let node = MeshV2Node(
            outbox: outbox,
            relayIdHex: config.relayIdHex,
            receiptKeySpkiBase64: config.receiptVerifyPublicKeySpkiBase64,
            directory: meshDirectory,
            nowMs: nowMs
        )
        node.relayEnabled = relayEnabled
        
        if let publicKey = Bundle.main.object(forInfoDictionaryKey: "SOSMeshBroadcastPublicKey") as? String,
           let verifier = try? BroadcastSignatureVerifier(publicKeyBase64: publicKey) {
            node.broadcastVerifier = { broadcast in
                verifier.verify(broadcast: broadcast)
            }
        }
        
        if let notificationManager = broadcastNotificationManager {
            node.broadcastNotifier = { broadcast in
                Task {
                    await notificationManager.showNotification(broadcast: broadcast)
                }
            }
        }
        
        node.locationProvider = {
            // Last known fix only; nil when location is not authorized or unknown.
            guard let location = CLLocationManager().location else { return nil }
            return (location.coordinate.latitude, location.coordinate.longitude)
        }
        
        meshNode = node
        gatewayProbe = GatewayProbe(baseURL: config.baseURL)
        if let meshRadioFactory {
            meshRadio = meshRadioFactory(outbox, receivedInboxStore)
        } else {
            meshRadio = LiveBleMeshRadio(outbox: outbox, inbox: receivedInboxStore, diagnostics: diagnostics, node: node)
        }
        relayForwarder = RelayForwarder(
            outbox: outbox,
            inbox: receivedInboxStore,
            uploader: relayUploader(),
            diagnostics: diagnostics,
            node: node,
            lookup: ReceiptLookupClient(baseURL: config.baseURL, receiptKeySpkiBase64: config.receiptVerifyPublicKeySpkiBase64)
        )
        relayForwarder?.restoreInbox()
        restartDiscoveryForCurrentMode()
        receivedInbox = receivedInboxStore.list()
        meshTickTimer?.invalidate()
        meshTickTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
                self.meshRadio?.tick(nowMs: nowMs)
                await self.reloadOutbox()
                self.receivedInbox = self.receivedInboxStore.list()
                await self.meshMaintenance(nowMs: nowMs)
                // Own SOS first, then carried copies (mesh v2 §9).
                await self.retryPendingServerUploads()
                await self.forwardReceivedEnvelopes()
                self.refreshRelayDiagnostics()
            }
        }
    }
}

extension AppModel {
    /// (Re)plans scan/advertise for the current relay switch and pending own SOS.
    func restartDiscoveryForCurrentMode() {
        guard let meshRadio else { return }
        let pending = outboxEntries.contains {
            $0.state == "LOCAL_SAVED" && $0.origin != SosOutboxService.relayOrigin
        }
        let decision = currentBleRoleDecision(pendingSos: pending)
        _ = meshRadio.startDiscovery(role: decision.0, relayEnabled: relayEnabled, pendingSos: pending)
    }

    /// Uploads envelopes received over BLE (still encrypted) with the regular ingest contract.
    /// Runs only while relay mode is on; failures keep the entry queued for the next retry.
    func forwardReceivedEnvelopes() async {
        guard relayEnabled, let relayForwarder else { return }
        await relayForwarder.forwardDue()
        receivedInbox = receivedInboxStore.list()
    }

    func meshMaintenance(nowMs: Int64) async {
        guard let node = meshNode else { return }
        await gatewayProbe?.probeIfDue(nowMs: nowMs, tracker: node.hops)
        if nowMs - lastMeshPurgeMs >= 60_000 {
            lastMeshPurgeMs = nowMs
            node.purgeExpired(nowMs: nowMs)
        }
        diagnostics.recordMesh(node.stats(nowMs: nowMs))
        updateRelayCounter()
    }
    
    private func updateRelayCounter() {
        guard let node = meshNode else { return }
        let tombstones = node.tombstones.allTombstones()
        for tombstone in tombstones {
            if tombstone.ackType == "SERVER_ACCEPTED" {
                relayCounter.recordDelivered(messageId: tombstone.messageId)
            }
        }
    }

    func refreshRelayDiagnostics() {
        var snapshot = diagnostics.snapshot()
        snapshot.pendingForward = relayForwarder?.pendingCount() ?? 0
        snapshot.relayDeliveredCount = relayCounter.deliveredCount()
        relayDiagnostics = snapshot
    }
    
    func hasOpenCase() -> Bool {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        return openCaseTracker.hasOpenCase(nowMs: nowMs)
    }

    fileprivate func relayUploader() -> RelayIngestUploading {
        if ingestUploader == nil {
            let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
            ingestUploader = IngestUploader(config: IngestConfig.production(deviceId: deviceId))
        }
        return ingestUploader!
    }

    static func preview(snapshot: PermissionGateSnapshot) -> AppModel {
        AppModel(permissionProbe: StubAppPermissionProbe(snapshot: snapshot))
    }
    
    private func handleReceivedInboxChange(old: [ReceivedSosRecord], new: [ReceivedSosRecord]) {
        if old.isEmpty {
            let ids = new.map(\.sosId)
            Task { @MainActor in SosNotificationManager.shared.seedIncomingIfNeeded(ids) }
        }
        let oldIds = Set(old.map(\.sosId))
        let newIds = Set(new.map(\.sosId))
        let addedIds = newIds.subtracting(oldIds)
        
        guard !addedIds.isEmpty else { return }
        
        let ownSosIds = Set(outboxEntries.filter { $0.origin != SosOutboxService.relayOrigin }.map(\.sosId))
        
        for sosId in addedIds {
            guard !ownSosIds.contains(sosId) else { continue }
            
            Task { @MainActor in
                await SosNotificationManager.shared.notifyIncomingSos(
                    sosId: sosId,
                    isRelayOnly: true
                )
            }
        }
    }
}
