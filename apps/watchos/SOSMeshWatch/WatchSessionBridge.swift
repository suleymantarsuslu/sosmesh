import CoreBluetooth
import Foundation
import SOSMeshCore
import WatchConnectivity

final class WatchSessionBridge: NSObject, WatchCompanionTransport, WCSessionDelegate {
    private weak var model: WatchAppModel?
    private let store: WatchOfflineQueueStore

    init(store: WatchOfflineQueueStore, model: WatchAppModel) {
        self.store = store
        self.model = model
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func currentSnapshot() -> WatchConnectivitySnapshot {
        let session = WCSession.default
        return WatchConnectivitySendPlanner.snapshot(
            isPaired: session.activationState == .activated,
            sessionActivated: session.activationState == .activated,
            isReachable: session.isReachable,
            isCompanionAppInstalled: session.isCompanionAppInstalled,
            watchLocked: false,
            lowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled
        )
    }

    func isPhoneReachable() -> Bool {
        WatchConnectivitySendPlanner.isPhoneReachableForQueue(snapshot: currentSnapshot())
    }

    func sendCreateToPhone(
        payload: Data,
        sendMode: WatchConnectivitySendMode,
        onSuccess: @escaping () -> Void,
        onFailure: @escaping (String) -> Void
    ) {
        let session = WCSession.default
        let message: [String: Any] = [
            WatchCompanionPaths.MessageKey.path: WatchCompanionPaths.sosCreate,
            WatchCompanionPaths.MessageKey.payloadBase64: payload.base64EncodedString(),
        ]
        switch sendMode {
        case .sendMessage:
            session.sendMessage(message, replyHandler: { _ in onSuccess() }, errorHandler: { error in
                onFailure(error.localizedDescription)
            })
        case .transferUserInfo:
            session.transferUserInfo(message)
            onSuccess()
        case .none:
            onFailure("send_mode_none")
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            model?.refreshConnectivityCopy()
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncoming(message)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handleIncoming(userInfo)
    }

    private func handleIncoming(_ message: [String: Any]) {
        guard let path = message[WatchCompanionPaths.MessageKey.path] as? String,
              path == WatchCompanionPaths.phoneAck,
              let b64 = message[WatchCompanionPaths.MessageKey.payloadBase64] as? String,
              let data = Data(base64Encoded: b64),
              let ack = try? WatchCompanionCodec.decodeAck(data)
        else { return }
        Task { @MainActor in
            model?.applyPhoneAck(ack)
        }
    }
}

// MARK: - Mesh v2 BLE fallback (central only)

/// watchOS has no CBPeripheralManager: the watch can never advertise, host GATT or relay for
/// others. While the app is in the foreground and the iPhone is unreachable, it may act as a
/// central and hand its OWN SOS to the nearby phone with the lowest `h` (mesh-v2.md §10.2).
/// Success means "a nearby phone received it" only, never server delivery.
final class WatchMeshHandoff: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    enum Outcome: Equatable {
        case peerReceived
        case noPeer
        case failed
    }

    private struct Seen {
        let peripheral: CBPeripheral
        var hops: UInt8
    }

    private static let scanWindow: TimeInterval = 8
    private static let overallTimeout: TimeInterval = 40

    private let queue = DispatchQueue(label: "com.sosmesh.watch.ble")
    private var central: CBCentralManager?
    private var seen: [UUID: Seen] = [:]
    private var tried = Set<UUID>()
    private var target: CBPeripheral?
    private var control: CBCharacteristic?
    private var data: CBCharacteristic?
    private var ack: CBCharacteristic?
    private var meshInfo: CBCharacteristic?
    private var payload = Data()
    private var messageId = ""
    private var completion: ((Outcome) -> Void)?
    private var engine: BleTransferEngine?
    private var tracker: SosPeerDeliveryTracker?
    private let outboxStub = NullOutboxQueueUpdater()
    private var awaitingOffer = false

    /// `l1Payload` = encoded MeshRelayEnvelopeV2 (hopCount 0) of the watch's own SOS.
    func start(messageId: String, l1Payload: Data, completion: @escaping (Outcome) -> Void) {
        queue.async {
            guard self.completion == nil else { return }
            self.messageId = messageId
            self.payload = l1Payload
            self.completion = completion
            self.seen = [:]
            self.tried = []
            if self.central == nil {
                self.central = CBCentralManager(delegate: self, queue: self.queue)
            } else {
                self.beginScan()
            }
            self.queue.asyncAfter(deadline: .now() + WatchMeshHandoff.overallTimeout) { [weak self] in
                self?.finish(.failed)
            }
        }
    }

    func cancel() {
        queue.async { self.finish(.failed) }
    }

    private func beginScan() {
        guard let central, central.state == .poweredOn else { return }
        let services = ([BleMeshConstants.serviceUUID] + MeshV2.allHopsServiceUUIDs).map { CBUUID(string: $0) }
        central.scanForPeripherals(withServices: services, options: nil)
        queue.asyncAfter(deadline: .now() + WatchMeshHandoff.scanWindow) { [weak self] in
            self?.connectBest()
        }
    }

    private func connectBest() {
        guard completion != nil, target == nil, let central else { return }
        central.stopScan()
        // Lowest h first; unknown h (0xFF) last. One connection at a time (watchOS limit).
        guard let best = seen.values.filter({ !tried.contains($0.peripheral.identifier) }).min(by: { $0.hops < $1.hops }) else {
            finish(.noPeer)
            return
        }
        tried.insert(best.peripheral.identifier)
        target = best.peripheral
        central.connect(best.peripheral, options: nil)
    }

    private func finish(_ outcome: Outcome) {
        guard let completion else { return }
        self.completion = nil
        central?.stopScan()
        if let target { central?.cancelPeripheralConnection(target) }
        target = nil
        engine?.senderLinkLost()
        engine = nil
        tracker = nil
        DispatchQueue.main.async { completion(outcome) }
    }

    private func retryNextOrFinish() {
        if let target { central?.cancelPeripheralConnection(target) }
        target = nil
        control = nil; data = nil; ack = nil; meshInfo = nil
        engine = nil
        connectBest()
    }

    // MARK: CBCentralManagerDelegate

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn, completion != nil {
            beginScan()
        } else if central.state != .poweredOn, central.state != .unknown, central.state != .resetting {
            finish(.failed)
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        var uuids = (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID]) ?? []
        uuids += (advertisementData[CBAdvertisementDataOverflowServiceUUIDsKey] as? [CBUUID]) ?? []
        var hops = MeshV2.hops(fromServiceUUIDs: uuids.map(\.uuidString))
        if let serviceData = advertisementData[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data],
           let fff0 = serviceData[CBUUID(string: BleMeshConstants.serviceUUID)],
           let fromData = MeshV2.hops(fromServiceData: fff0) {
            hops = fromData
        }
        seen[peripheral.identifier] = Seen(peripheral: peripheral, hops: hops ?? MeshV2.offline)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.delegate = self
        peripheral.discoverServices([CBUUID(string: BleMeshConstants.serviceUUID)])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        retryNextOrFinish()
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        if completion != nil, peripheral.identifier == target?.identifier {
            retryNextOrFinish()
        }
    }

    // MARK: CBPeripheralDelegate

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let service = peripheral.services?.first(where: { BleMeshConstants.canonicalUuid($0.uuid.uuidString) == BleMeshConstants.serviceUUID }) else {
            retryNextOrFinish()
            return
        }
        peripheral.discoverCharacteristics(nil, for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        for c in service.characteristics ?? [] {
            switch BleMeshConstants.canonicalUuid(c.uuid.uuidString) {
            case BleMeshConstants.controlCharacteristicUUID: control = c
            case BleMeshConstants.dataCharacteristicUUID: data = c
            case BleMeshConstants.ackCharacteristicUUID: ack = c
            case MeshV2.meshInfoCharacteristicUUID: meshInfo = c
            default: break
            }
        }
        guard let ack, control != nil, data != nil else {
            retryNextOrFinish()
            return
        }
        peripheral.setNotifyValue(true, for: ack)
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, characteristic.isNotifying else {
            retryNextOrFinish()
            return
        }
        makeEngine(for: peripheral)
        if meshInfo != nil, let control, let offer = MeshV2Frame.offer([MeshV2.messageKey(messageId)]).encode() {
            awaitingOffer = true
            peripheral.writeValue(offer, for: control, type: .withResponse)
            queue.asyncAfter(deadline: .now() + .milliseconds(Int(MeshV2.offerReplyTimeoutMs))) { [weak self] in
                guard let self, self.awaitingOffer else { return }
                self.awaitingOffer = false
                self.startTransfer()
            }
        } else {
            startTransfer()
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, let value = characteristic.value,
              BleMeshConstants.canonicalUuid(characteristic.uuid.uuidString) == BleMeshConstants.ackCharacteristicUUID else { return }
        if MeshV2Frame.isMeshV2(value) {
            guard awaitingOffer, case .offerReply(let statuses) = MeshV2Frame.decode(value) else { return }
            awaitingOffer = false
            switch statuses.first ?? .want {
            case .want: startTransfer()
            case .have, .delivered: finish(.peerReceived)
            case .full, .refused: retryNextOrFinish()
            }
            return
        }
        engine?.deliverCentralNotification(uuid: BleMeshConstants.ackCharacteristicUUID, value: value)
    }

    private func makeEngine(for peripheral: CBPeripheral) {
        let writer = PeripheralWriter(peripheral: peripheral, characteristics: [
            BleMeshConstants.controlCharacteristicUUID: control,
            BleMeshConstants.dataCharacteristicUUID: data,
        ])
        let tracker = SosPeerDeliveryTracker(outbox: outboxStub)
        tracker.onActiveFinished = { [weak self] _, success in
            guard let self else { return }
            if success { self.finish(.peerReceived) } else { self.retryNextOrFinish() }
        }
        let engine = BleTransferEngine(
            serverOutbound: writer,
            clientOutbound: writer,
            peerDeliveryTracker: tracker,
            clock: SystemBleTransferClock(queue: queue)
        )
        engine.setSenderMtu(peripheral.maximumWriteValueLength(for: .withResponse) + BleTransferProtocolConstants.attOverhead)
        self.tracker = tracker
        self.engine = engine
    }

    private func startTransfer() {
        guard let engine, engine.prepareSenderForNextTransfer() else {
            retryNextOrFinish()
            return
        }
        engine.sendOutbound(sosId: messageId, digest: "watch", payload: payload)
    }

    private final class PeripheralWriter: GattOutboundWriting {
        weak var peripheral: CBPeripheral?
        let characteristics: [String: CBCharacteristic?]
        init(peripheral: CBPeripheral, characteristics: [String: CBCharacteristic?]) {
            self.peripheral = peripheral
            self.characteristics = characteristics
        }
        func writeCharacteristic(uuid: String, value: Data) {
            guard let c = characteristics[BleMeshConstants.canonicalUuid(uuid)] ?? nil else { return }
            peripheral?.writeValue(value, for: c, type: .withResponse)
        }
    }

    }
}
