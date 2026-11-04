import CoreBluetooth
import Foundation
import SOSMeshCore

/// Live CoreBluetooth radio.
///
/// Roles (see docs/ios/ble-relay.md):
/// - Every device scans, and connects as a central only to hand over its own pending SOS.
/// - A device advertises and hosts the GATT server whenever relay mode is on (or the role asks for it).
///
/// All mutable state is confined to the serial `queue`; the public entry points hop onto it.
public final class LiveBleMeshRadio: NSObject, BleMeshRadioPort, CBCentralManagerDelegate, CBPeripheralManagerDelegate {
    private struct PeerEntry {
        let peripheral: CBPeripheral
        var lastSeenMs: Int64
        var lastAttemptMs: Int64
        /// Mesh v2 `h` from the advertisement (0xFF = offline / unknown).
        var hops: UInt8 = MeshV2.offline
    }

    private static let connectTimeoutMs: Int64 = 10_000
    private static let peerStaleMs: Int64 = 60_000
    private static let rescanIntervalMs: Int64 = 20_000

    private let outbox: SosOutboxService
    private let inbox: ReceivedSosInbox
    private let diagnostics: RelayDiagnostics
    private let serverBridge = BleGattServerBridge()
    private let clientBridge = BleGattClientBridge()
    private let session: BleMeshSession
    private let centralCoordinator = BleCentralCoordinator()
    private let peripheralCoordinator = BlePeripheralCoordinator()
    private var centralManager: CBCentralManager?
    private var peripheralManager: CBPeripheralManager?
    private let queue: DispatchQueue
    private let router: BleIncomingPayloadRouter
    /// `BleGattClientBridge` and the transfer receiver hold their listeners weakly; keep them alive here.
    private var clientCallback: ClientCallback?
    private let queueKey = DispatchSpecificKey<Void>()
    private var peers: [UUID: PeerEntry] = [:]
    private var scanning = false
    private var advertising = false
    private var advertisingRequested = false
    private var wantsAdvertising = false
    private var gattReady = false
    private var inboundSubscribers = 0
    private var discoveryRequested = false
    private var connectingPeerId: UUID?
    private var connectingStartedMs: Int64 = 0
    private var connectedPeripheral: CBPeripheral?
    private var lastScanStartMs: Int64 = 0
    private var authorization: BleAuthorizationSnapshot = .unknown
    /// Mesh v2 (docs/protocol/mesh-v2.md). nil keeps the v1-only behaviour.
    private let node: MeshV2Node?
    private var centralSession: MeshV2CentralSession?
    private var peerInfoResult: MeshInfo??
    private static let peerRetryMs: Int64 = 15_000

    public var transferEngine: BleTransferEngine { session.engine }

    public init(
        outbox: SosOutboxService,
        inbox: ReceivedSosInbox,
        diagnostics: RelayDiagnostics = RelayDiagnostics(),
        node: MeshV2Node? = nil
    ) {
        self.node = node
        self.outbox = outbox
        self.inbox = inbox
        self.diagnostics = diagnostics
        let radioQueue = DispatchQueue(label: "com.sosmesh.ble.radio")
        queue = radioQueue
        let router = BleIncomingPayloadRouter(
            inbox: inbox,
            store: RelayOutboxEnvelopeStore(outbox: outbox),
            diagnostics: diagnostics,
            node: node
        )
        self.router = router
        let serverOut = ServerOutboundWriter()
        let clientOut = ClientOutboundWriter()
        session = BleMeshSession(
            serverOutbound: serverOut,
            clientOutbound: clientOut,
            outbox: outbox,
            incomingRouter: router,
            clock: SystemBleTransferClock(queue: radioQueue)
        )
        super.init()
        clientCallback = ClientCallback(radio: self)
        queue.setSpecific(key: queueKey, value: ())
        serverOut.handler = { [weak self] uuid, value in
            _ = self?.serverBridge.notifyCharacteristic(uuid: uuid, value: value, deviceAddress: nil)
        }
        clientOut.handler = { [weak self] uuid, value in
            self?.clientBridge.writeCharacteristic(uuid: uuid, value: value)
        }
        serverBridge.setWriteListener(GattWriteTap { [weak self] uuid, value, _ in
            guard let self else { return }
            if let node = self.node, uuid == BleMeshConstants.controlCharacteristicUUID, MeshV2Frame.isMeshV2(value) {
                let now = Int64(Date().timeIntervalSince1970 * 1000)
                for frame in node.respond(toControl: value, nowMs: now) {
                    _ = self.serverBridge.notifyCharacteristic(uuid: BleMeshConstants.ackCharacteristicUUID, value: frame, deviceAddress: nil)
                }
                return
            }
            self.session.engine.deliverPeripheralWrite(uuid: uuid, value: value)
        })
        if let node {
            serverBridge.meshInfoProvider = {
                node.meshInfo(nowMs: Int64(Date().timeIntervalSince1970 * 1000)).encode()
            }
            clientBridge.onMeshInfo = { [weak self] data in
                guard let self else { return }
                self.peerInfoResult = .some(data.flatMap { MeshInfo.decode($0) })
                self.startCentralSessionIfReady()
            }
            session.observeTransferFinished { [weak self] _, success in
                guard let self, let central = self.centralSession else { return }
                self.perform(central.transferFinished(success: success, nowMs: Int64(Date().timeIntervalSince1970 * 1000)))
            }
        }
        serverBridge.onAdvertisingChanged = { [weak self] isAdvertising in
            self?.advertising = isAdvertising
            self?.publishDiagnostics()
        }
        serverBridge.onSubscriberCountChanged = { [weak self] count in
            self?.inboundSubscribers = count
            self?.publishDiagnostics()
        }
        serverBridge.onCentralLeft = { [weak self] in
            self?.session.engine.receiverLinkLost()
        }
        clientBridge.onWriteError = { [weak self] in
            self?.diagnostics.recordError(code: "gatt_write_failed")
        }
        session.engine.setRelayListener(router)
        session.observeSendResults(
            completed: { [weak self] in
                self?.diagnostics.recordSent(nowMs: Int64(Date().timeIntervalSince1970 * 1000))
            },
            failed: { [weak self] code in
                self?.diagnostics.recordError(code: "send_\(code.rawValue)")
            }
        )
    }

    // MARK: BleMeshRadioPort

    /// Starts (or re-plans) discovery. Safe to call again when relay mode or the role changes.
    public func startDiscovery(role: BlePeerRole, relayEnabled: Bool, pendingSos: Bool) -> Result<Void, Error> {
        _ = pendingSos
        let advertise = relayEnabled || role == .relay || role == .both
        if centralManager == nil {
            centralManager = centralCoordinator.makeCentralManager(queue: queue, options: nil)
            centralManager?.delegate = self
        }
        if peripheralManager == nil {
            peripheralManager = peripheralCoordinator.makePeripheralManager(queue: queue, options: nil)
            peripheralManager?.delegate = self
            serverBridge.attach(manager: peripheralManager!)
        }
        let authorization = onRadioQueue { () -> BleAuthorizationSnapshot in
            self.discoveryRequested = true
            self.wantsAdvertising = advertise
            self.refreshAuthorizationFromManagers()
            // A fresh manager reports .unknown until its delegate fires, so never bail on that:
            // scanning/advertising begin from the state callbacks once Bluetooth is powered on.
            self.applyRadioPlan()
            return self.authorization
        }
        switch authorization {
        case .poweredOff, .unauthorized, .unsupported:
            return .failure(NSError(domain: "LiveBleMeshRadio", code: 1, userInfo: nil))
        default:
            return .success(())
        }
    }

    public func stopDiscovery() {
        onRadioQueue {
            self.discoveryRequested = false
            self.wantsAdvertising = false
            self.centralManager?.stopScan()
            if let peripheral = self.connectedPeripheral ?? self.connectingPeripheral() {
                self.centralManager?.cancelPeripheralConnection(peripheral)
            }
            self.serverBridge.stop()
            self.clientBridge.disconnect()
            self.session.engine.senderLinkLost()
            self.session.engine.receiverLinkLost()
            self.connectingPeerId = nil
            self.connectedPeripheral = nil
            self.scanning = false
            self.advertising = false
            self.advertisingRequested = false
            self.gattReady = false
            self.publishDiagnostics()
        }
    }

    public func refreshSnapshot() -> BleRadioSnapshot {
        onRadioQueue { () -> BleRadioSnapshot in
            self.refreshAuthorizationFromManagers()
            return BleRadioSnapshot(
                authorization: self.authorization,
                scanning: self.scanning,
                advertising: self.advertising,
                peerCount: self.peers.count,
                gattReady: self.gattReady,
                statusMessage: self.gattReady ? "GATT session ready" : "Awaiting peer connection"
            )
        }
    }

    public func tick(nowMs: Int64) {
        queue.async { [weak self] in self?.tickOnQueue(nowMs: nowMs) }
    }

    public func connectFirstPeerIfNeeded() -> Result<Void, Error> {
        onRadioQueue { () -> Result<Void, Error> in
            let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
            return self.connectIfNeeded(nowMs: nowMs)
        }
    }

    // MARK: Queue helpers

    private func onRadioQueue<T>(_ work: () -> T) -> T {
        if DispatchQueue.getSpecific(key: queueKey) != nil {
            return work()
        }
        return queue.sync(execute: work)
    }

    // MARK: Radio plan (queue only)

    private func applyRadioPlan() {
        guard discoveryRequested else { return }
        if let centralManager, centralManager.state == .poweredOn, !scanning {
            startScan()
        }
        if let peripheralManager, peripheralManager.state == .poweredOn {
            if wantsAdvertising, !advertisingRequested {
                if case .success = serverBridge.start() {
                    advertisingRequested = true
                }
            } else if !wantsAdvertising, advertisingRequested {
                serverBridge.stop()
                advertisingRequested = false
                advertising = false
            }
        }
        publishDiagnostics()
    }

    private func startScan() {
        guard let centralManager else { return }
        centralCoordinator.scanForMeshPeers(centralManager)
        scanning = true
        lastScanStartMs = Int64(Date().timeIntervalSince1970 * 1000)
    }

    private func tickOnQueue(nowMs: Int64) {
        guard discoveryRequested else { return }
        // Restart the scan periodically: without duplicates CoreBluetooth reports a peer only once
        // per scan session, so this refreshes `lastSeen` and lets stale peers age out.
        if scanning, nowMs - lastScanStartMs >= LiveBleMeshRadio.rescanIntervalMs, let centralManager,
           centralManager.state == .poweredOn {
            centralManager.stopScan()
            startScan()
        }
        peers = peers.filter { entry in
            let id = entry.key
            return nowMs - entry.value.lastSeenMs < LiveBleMeshRadio.peerStaleMs
                || id == connectingPeerId || id == connectedPeripheral?.identifier
        }
        if let id = connectingPeerId, nowMs - connectingStartedMs > LiveBleMeshRadio.connectTimeoutMs,
           let peripheral = peers[id]?.peripheral {
            centralManager?.cancelPeripheralConnection(peripheral)
            connectingPeerId = nil
        }
        if let node {
            serverBridge.updateAdvertisedHops(node.hops.compute(nowMs: nowMs))
            if gattReady {
                if let central = centralSession { perform(central.tick(nowMs: nowMs)) }
            } else {
                _ = connectIfNeeded(nowMs: nowMs)
            }
        } else if gattReady {
            do {
                _ = try session.sendDueOutboxEntryIfReady(gattReady: true)
            } catch {
                diagnostics.recordError(code: "outbox_read_failed")
            }
        } else {
            _ = connectIfNeeded(nowMs: nowMs)
        }
        publishDiagnostics()
    }

    /// Connects as a central only when an own SOS is waiting to be handed over.
    private func connectIfNeeded(nowMs: Int64) -> Result<Void, Error> {
        guard discoveryRequested, !gattReady, connectingPeerId == nil, connectedPeripheral == nil,
              let centralManager, centralManager.state == .poweredOn else {
            return .success(())
        }
        let candidate: PeerEntry
        if let node {
            // Route toward the lowest `h`; only peers we still have something for (§4.3).
            let eligible = peers.values.filter { peer in
                nowMs - peer.lastAttemptMs >= LiveBleMeshRadio.peerRetryMs
                    && !node.candidates(forPeer: peer.peripheral.identifier.uuidString, peerHops: peer.hops, nowMs: nowMs).isEmpty
            }
            guard let best = eligible.min(by: { ($0.hops, $0.lastAttemptMs) < ($1.hops, $1.lastAttemptMs) }) else {
                return .success(())
            }
            candidate = best
        } else {
            guard session.hasDueOwnOutbound() else { return .success(()) }
            // Try the least recently attempted peer first so one unreachable phone cannot block the rest.
            guard let best = peers.values.min(by: { $0.lastAttemptMs < $1.lastAttemptMs }) else {
                return .failure(NSError(domain: "LiveBleMeshRadio", code: 2, userInfo: nil))
            }
            candidate = best
        }
        let id = candidate.peripheral.identifier
        peers[id]?.lastAttemptMs = nowMs
        connectingPeerId = id
        connectingStartedMs = nowMs
        centralManager.connect(candidate.peripheral, options: nil)
        return .success(())
    }

    private func connectingPeripheral() -> CBPeripheral? {
        guard let id = connectingPeerId else { return nil }
        return peers[id]?.peripheral
    }

    private func publishDiagnostics() {
        let bluetooth = authorization
        let isScanning = scanning
        let isAdvertising = advertising
        let peerCount = peers.count
        let connected = (gattReady ? 1 : 0) + inboundSubscribers
        if let node {
            diagnostics.recordMesh(node.stats(nowMs: Int64(Date().timeIntervalSince1970 * 1000)))
        }
        diagnostics.update {
            $0.bluetooth = bluetooth
            $0.scanning = isScanning
            $0.advertising = isAdvertising
            $0.peersSeen = peerCount
            $0.connectedPeers = connected
        }
    }

    // MARK: CBCentralManagerDelegate

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        refreshAuthorizationFromManagers()
        if central.state == .poweredOn {
            applyRadioPlan()
        } else {
            scanning = false
            gattReady = false
            connectingPeerId = nil
            connectedPeripheral = nil
            clientBridge.disconnect()
            session.engine.senderLinkLost()
            publishDiagnostics()
        }
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        if var existing = peers[peripheral.identifier] {
            existing.lastSeenMs = nowMs
            peers[peripheral.identifier] = existing
        } else {
            peers[peripheral.identifier] = PeerEntry(peripheral: peripheral, lastSeenMs: nowMs, lastAttemptMs: 0)
        }
        if let node {
            let hops = LiveBleMeshRadio.advertisedHops(advertisementData)
            peers[peripheral.identifier]?.hops = hops ?? MeshV2.offline
            if let hops {
                node.hops.observe(peerId: peripheral.identifier.uuidString, hops: hops, nowMs: nowMs)
            }
        }
        publishDiagnostics()
        // Hand over a waiting SOS as soon as a peer shows up instead of waiting for the next tick.
        _ = connectIfNeeded(nowMs: nowMs)
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        connectedPeripheral = peripheral
        centralSession = nil
        peerInfoResult = nil
        if clientCallback == nil { clientCallback = ClientCallback(radio: self) }
        if let clientCallback {
            clientBridge.connect(peripheral: peripheral, callback: clientCallback)
        }
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        connectingPeerId = nil
        connectedPeripheral = nil
        gattReady = false
        diagnostics.recordError(code: "connect_failed")
        publishDiagnostics()
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        endCentralSession(peerId: peripheral.identifier.uuidString)
        connectingPeerId = nil
        connectedPeripheral = nil
        gattReady = false
        clientBridge.disconnect()
        session.engine.senderLinkLost()
        publishDiagnostics()
    }

    // MARK: CBPeripheralManagerDelegate

    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        refreshAuthorizationFromManagers()
        if peripheral.state == .poweredOn {
            applyRadioPlan()
        } else {
            advertising = false
            advertisingRequested = false
            inboundSubscribers = 0
            session.engine.receiverLinkLost()
            publishDiagnostics()
        }
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        serverBridge.peripheralManager(peripheral, didAdd: service, error: error)
    }

    public func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        serverBridge.peripheralManagerDidStartAdvertising(peripheral, error: error)
    }

    public func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) {
        serverBridge.peripheralManagerIsReady(toUpdateSubscribers: peripheral)
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
        serverBridge.peripheralManager(peripheral, central: central, didSubscribeTo: characteristic)
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
        serverBridge.peripheralManager(peripheral, central: central, didUnsubscribeFrom: characteristic)
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        serverBridge.peripheralManager(peripheral, didReceiveWrite: requests)
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        serverBridge.peripheralManager(peripheral, didReceiveRead: request)
    }

    // MARK: Mesh v2 central session (queue only)

    /// `h` from an advertisement: Android service data on FFF0, or the iOS hops UUID
    /// (also in the overflow area while the advertiser is in the background).
    static func advertisedHops(_ advertisementData: [String: Any]) -> UInt8? {
        if let serviceData = advertisementData[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data],
           let data = serviceData[CBUUID(string: BleMeshConstants.serviceUUID)],
           let hops = MeshV2.hops(fromServiceData: data) {
            return hops <= UInt8(MeshV2.maxHops) ? hops : nil
        }
        var uuids = (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID]) ?? []
        uuids += (advertisementData[CBAdvertisementDataOverflowServiceUUIDsKey] as? [CBUUID]) ?? []
        return MeshV2.hops(fromServiceUUIDs: uuids.map(\.uuidString))
    }

    private func startCentralSessionIfReady() {
        guard let node, gattReady, centralSession == nil, let peripheral = connectedPeripheral,
              let info = peerInfoResult else { return }
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        let central = MeshV2CentralSession(node: node, peerId: peripheral.identifier.uuidString, peerInfo: info)
        centralSession = central
        perform(central.start(nowMs: nowMs))
    }

    private func perform(_ actions: [MeshV2CentralSession.Action]) {
        for action in actions {
            switch action {
            case .writeControl(let frame):
                clientBridge.writeCharacteristic(uuid: BleMeshConstants.controlCharacteristicUUID, value: frame)
            case .transfer(let sosId, let digest, let payload):
                if !session.sendPayload(sosId: sosId, digest: digest, payload: payload) {
                    diagnostics.recordError(code: "send_busy")
                }
            case .finished:
                // Visit done: free the link so other centrals can reach this peer.
                centralSession = nil
                if let peripheral = connectedPeripheral {
                    centralManager?.cancelPeripheralConnection(peripheral)
                }
            }
        }
    }

    private func endCentralSession(peerId: String) {
        centralSession = nil
        peerInfoResult = nil
        node?.hops.linkLost(peerId: peerId)
    }

    // MARK: Helpers

    private func refreshAuthorizationFromManagers() {
        let centralState = centralManager?.state ?? .unknown
        switch centralState {
        case .poweredOn:
            authorization = .poweredOn
        case .poweredOff:
            authorization = .poweredOff
        case .unauthorized:
            authorization = .unauthorized
        case .unsupported:
            authorization = .unsupported
        default:
            authorization = .unknown
        }
    }

    fileprivate func clientReady() {
        connectingPeerId = nil
        gattReady = true
        session.engine.onGattReady()
        if node != nil, !clientBridge.peerHasMeshInfo, peerInfoResult == nil {
            peerInfoResult = .some(nil)
        }
        startCentralSessionIfReady()
        publishDiagnostics()
    }

    fileprivate func clientLinkDown() {
        guard gattReady || connectingPeerId != nil || connectedPeripheral != nil else { return }
        if let peripheral = connectedPeripheral {
            centralManager?.cancelPeripheralConnection(peripheral)
        }
        gattReady = false
        connectingPeerId = nil
        if let peerId = connectedPeripheral?.identifier.uuidString { endCentralSession(peerId: peerId) }
        session.engine.senderLinkLost()
        publishDiagnostics()
    }

    fileprivate func applyMtu(_ mtu: Int) {
        session.engine.setSenderMtu(mtu)
    }

    fileprivate final class ClientCallback: GattClientCallbackPort {
        weak var radio: LiveBleMeshRadio?
        init(radio: LiveBleMeshRadio) { self.radio = radio }
        func onConnectionStateChanged(_ state: GattConnectionState) {
            switch state {
            case .ready:
                radio?.clientReady()
            case .disconnected:
                radio?.clientLinkDown()
            default:
                break
            }
        }
        func onServicesDiscovered() {}
        func onMtuChanged(mtu: Int) { radio?.applyMtu(mtu) }
        func onCharacteristicChanged(uuid: String, value: Data) {
            guard let radio else { return }
            if uuid == BleMeshConstants.ackCharacteristicUUID, MeshV2Frame.isMeshV2(value) {
                if let central = radio.centralSession {
                    radio.perform(central.handleNotification(value, nowMs: Int64(Date().timeIntervalSince1970 * 1000)))
                }
                return
            }
            radio.session.engine.deliverCentralNotification(uuid: uuid, value: value)
        }
    }

    private final class ServerOutboundWriter: GattOutboundWriting {
        var handler: ((String, Data) -> Void)?
        func writeCharacteristic(uuid: String, value: Data) { handler?(uuid, value) }
    }

    private final class ClientOutboundWriter: GattOutboundWriting {
        var handler: ((String, Data) -> Void)?
        func writeCharacteristic(uuid: String, value: Data) { handler?(uuid, value) }
    }

    private final class GattWriteTap: GattServerWriteListener {
        let handler: (String, Data, String) -> Void
        init(_ handler: @escaping (String, Data, String) -> Void) { self.handler = handler }
        func onCharacteristicWrite(uuid: String, value: Data, deviceAddress: String) {
            handler(uuid, value, deviceAddress)
        }
    }
}
