import CoreBluetooth
import Foundation
import SOSMeshCore

public final class LiveBleMeshRadio: NSObject, BleMeshRadioPort, CBCentralManagerDelegate, CBPeripheralManagerDelegate {
    private let outbox: SosOutboxService
    private let inbox: ReceivedSosInbox
    private let serverBridge = BleGattServerBridge()
    private let clientBridge = BleGattClientBridge()
    private let session: BleMeshSession
    private let centralCoordinator = BleCentralCoordinator()
    private let peripheralCoordinator = BlePeripheralCoordinator()
    private var centralManager: CBCentralManager?
    private var peripheralManager: CBPeripheralManager?
    private let queue = DispatchQueue(label: "com.sosmesh.ble.radio")
    private var discoveredPeripherals: [CBPeripheral] = []
    private var scanning = false
    private var advertising = false
    private var gattReady = false
    private var authorization: BleAuthorizationSnapshot = .unknown

    public var transferEngine: BleTransferEngine { session.engine }

    public init(outbox: SosOutboxService, inbox: ReceivedSosInbox) {
        self.outbox = outbox
        self.inbox = inbox
        let router = BleIncomingPayloadRouter(inbox: inbox)
        let serverOut = ServerOutboundWriter()
        let clientOut = ClientOutboundWriter()
        session = BleMeshSession(
            serverOutbound: serverOut,
            clientOutbound: clientOut,
            outbox: outbox,
            incomingRouter: router
        )
        super.init()
        serverOut.handler = { [weak self] uuid, value in
            _ = self?.serverBridge.notifyCharacteristic(uuid: uuid, value: value, deviceAddress: nil)
        }
        clientOut.handler = { [weak self] uuid, value in
            self?.clientBridge.writeCharacteristic(uuid: uuid, value: value)
        }
        serverBridge.setWriteListener(GattWriteTap { [weak self] uuid, value, _ in
            self?.session.engine.deliverPeripheralWrite(uuid: uuid, value: value)
        })
        session.engine.setRelayListener(router)
    }

    public func startDiscovery(role: BlePeerRole, relayEnabled: Bool, pendingSos: Bool) -> Result<Void, Error> {
        _ = role
        _ = relayEnabled
        _ = pendingSos
        if centralManager == nil {
            centralManager = centralCoordinator.makeCentralManager(queue: queue, options: nil)
            centralManager?.delegate = self
        }
        if peripheralManager == nil {
            peripheralManager = peripheralCoordinator.makePeripheralManager(queue: queue, options: nil)
            peripheralManager?.delegate = self
            serverBridge.attach(manager: peripheralManager!)
        }
        refreshAuthorizationFromManagers()
        guard authorization == .poweredOn else {
            return .failure(NSError(domain: "LiveBleMeshRadio", code: 1, userInfo: nil))
        }
        centralCoordinator.scanForMeshPeers(centralManager!)
        scanning = true
        switch serverBridge.start() {
        case .success:
            advertising = true
        case .failure(let error):
            scanning = false
            return .failure(error)
        }
        return .success(())
    }

    public func stopDiscovery() {
        centralManager?.stopScan()
        serverBridge.stop()
        clientBridge.disconnect()
        scanning = false
        advertising = false
        gattReady = false
    }

    public func refreshSnapshot() -> BleRadioSnapshot {
        refreshAuthorizationFromManagers()
        return BleRadioSnapshot(
            authorization: authorization,
            scanning: scanning,
            advertising: advertising,
            peerCount: discoveredPeripherals.count,
            gattReady: gattReady,
            statusMessage: gattReady ? "GATT session ready" : "Awaiting peer connection"
        )
    }

    public func tick(nowMs: Int64) {
        _ = nowMs
        if gattReady {
            try? session.sendDueOutboxEntryIfReady(gattReady: true)
        } else {
            _ = connectFirstPeerIfNeeded()
        }
    }

    public func connectFirstPeerIfNeeded() -> Result<Void, Error> {
        guard let peer = discoveredPeripherals.first, let centralManager else {
            return .failure(NSError(domain: "LiveBleMeshRadio", code: 2, userInfo: nil))
        }
        clientBridge.connect(peripheral: peer, callback: ClientCallback(radio: self))
        centralManager.connect(peer, options: nil)
        return .success(())
    }

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        refreshAuthorizationFromManagers()
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        if !discoveredPeripherals.contains(where: { $0.identifier == peripheral.identifier }) {
            discoveredPeripherals.append(peripheral)
        }
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        clientBridge.connect(peripheral: peripheral, callback: ClientCallback(radio: self))
    }

    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        refreshAuthorizationFromManagers()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        serverBridge.peripheralManager(peripheral, didReceiveWrite: requests)
    }

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

    fileprivate func markGattReady() {
        gattReady = true
        session.engine.onGattReady()
    }

    private final class ClientCallback: GattClientCallbackPort {
        weak var radio: LiveBleMeshRadio?
        init(radio: LiveBleMeshRadio) { self.radio = radio }
        func onConnectionStateChanged(_ state: GattConnectionState) {
            if state == .ready { radio?.markGattReady() }
        }
        func onServicesDiscovered() {}
        func onMtuChanged(mtu: Int) { _ = mtu }
        func onCharacteristicChanged(uuid: String, value: Data) {
            radio?.session.engine.deliverCentralNotification(uuid: uuid, value: value)
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
