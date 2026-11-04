import CoreBluetooth
import Foundation
import SOSMeshCore

public final class BleGattServerBridge: NSObject, GattServerPort {
    private var peripheralManager: CBPeripheralManager?
    private var writeListener: GattServerWriteListener?
    private var characteristics: [String: CBMutableCharacteristic] = [:]
    private var pendingNotifications: [(CBMutableCharacteristic, Data)] = []
    private var subscribedCentrals = Set<UUID>()
    private var advertisingRequested = false

    /// Reports whether the service is actually being advertised (after `didStartAdvertising`).
    public var onAdvertisingChanged: ((Bool) -> Void)?
    /// Reports the number of centrals subscribed to ACK notifications.
    public var onSubscriberCountChanged: ((Int) -> Void)?
    /// A central unsubscribed (link dropped): the receiver should forget partial transfer state.
    public var onCentralLeft: (() -> Void)?

    public override init() {
        super.init()
    }

    public func attach(manager: CBPeripheralManager) {
        peripheralManager = manager
    }

    /// Adds the transfer service and starts advertising once the service was added.
    public func start() -> Result<Void, Error> {
        guard let peripheralManager else {
            return .failure(NSError(domain: "BleGattServer", code: 1, userInfo: [NSLocalizedDescriptionKey: "No peripheral manager"]))
        }
        if peripheralManager.state != .poweredOn {
            return .failure(NSError(domain: "BleGattServer", code: 2, userInfo: [NSLocalizedDescriptionKey: "Bluetooth not powered on"]))
        }
        peripheralManager.stopAdvertising()
        peripheralManager.removeAllServices()
        pendingNotifications.removeAll()
        subscribedCentrals.removeAll()
        let coordinator = BlePeripheralCoordinator()
        let createdCharacteristics = coordinator.startTransferService(on: peripheralManager)
        characteristics.removeAll()
        for characteristic in createdCharacteristics {
            characteristics[BleMeshConstants.canonicalUuid(characteristic.uuid.uuidString)] = characteristic
        }
        advertisingRequested = true
        return .success(())
    }

    public func stop() {
        advertisingRequested = false
        peripheralManager?.stopAdvertising()
        peripheralManager?.removeAllServices()
        pendingNotifications.removeAll()
        subscribedCentrals.removeAll()
        onAdvertisingChanged?(false)
        onSubscriberCountChanged?(0)
    }

    public func setWriteListener(_ listener: GattServerWriteListener?) {
        writeListener = listener
    }

    public func notifyCharacteristic(uuid: String, value: Data, deviceAddress: String?) -> Result<Void, Error> {
        guard let peripheralManager, let characteristic = characteristics[BleMeshConstants.canonicalUuid(uuid)] else {
            return .failure(NSError(domain: "BleGattServer", code: 3, userInfo: nil))
        }
        if pendingNotifications.isEmpty,
           peripheralManager.updateValue(value, for: characteristic, onSubscribedCentrals: nil) {
            return .success(())
        }
        // Transmit queue is full: keep order and flush from `peripheralManagerIsReady`.
        pendingNotifications.append((characteristic, value))
        return .success(())
    }

    // MARK: Delegate forwarding (the radio owns the CBPeripheralManager delegate)

    public func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        guard advertisingRequested else { return }
        if error != nil {
            onAdvertisingChanged?(false)
            return
        }
        let advertisement: [String: Any] = [
            CBAdvertisementDataServiceUUIDsKey: [CBUUID(string: BleMeshConstants.serviceUUID)],
        ]
        peripheral.startAdvertising(advertisement)
    }

    public func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        onAdvertisingChanged?(error == nil && advertisingRequested)
    }

    public func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) {
        while let next = pendingNotifications.first {
            if peripheral.updateValue(next.1, for: next.0, onSubscribedCentrals: nil) {
                pendingNotifications.removeFirst()
            } else {
                break
            }
        }
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
        subscribedCentrals.insert(central.identifier)
        onSubscriberCountChanged?(subscribedCentrals.count)
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
        subscribedCentrals.remove(central.identifier)
        onSubscriberCountChanged?(subscribedCentrals.count)
        onCentralLeft?()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        for request in requests {
            let uuid = BleMeshConstants.canonicalUuid(request.characteristic.uuid.uuidString)
            let value = request.value ?? Data()
            writeListener?.onCharacteristicWrite(uuid: uuid, value: value, deviceAddress: "central")
        }
        // CoreBluetooth expects exactly one response, to the first request of the batch.
        if let first = requests.first {
            peripheral.respond(to: first, withResult: .success)
        }
    }
}

public final class BleGattClientBridge: NSObject, GattClientPort, CBPeripheralDelegate {
    private weak var callback: GattClientCallbackPort?
    private var peripheral: CBPeripheral?
    private var ackCharacteristic: CBCharacteristic?
    private var dataCharacteristic: CBCharacteristic?
    private var controlCharacteristic: CBCharacteristic?

    /// A GATT write failed (link or permission problem). Counter only, no payload.
    public var onWriteError: (() -> Void)?

    public func connect(peerAddress: String, serviceUuid: String, callback: GattClientCallbackPort) -> Result<Void, Error> {
        self.callback = callback
        callback.onConnectionStateChanged(.connecting)
        return .failure(NSError(domain: "BleGattClient", code: 10, userInfo: [NSLocalizedDescriptionKey: "Use connect(peripheral:)"]))
    }

    /// Call from `centralManager(_:didConnect:)`: starts service discovery on the connected peripheral.
    public func connect(peripheral: CBPeripheral, callback: GattClientCallbackPort) {
        self.callback = callback
        self.peripheral = peripheral
        ackCharacteristic = nil
        dataCharacteristic = nil
        controlCharacteristic = nil
        peripheral.delegate = self
        callback.onConnectionStateChanged(.connected)
        peripheral.discoverServices([CBUUID(string: BleMeshConstants.serviceUUID)])
    }

    public func disconnect() {
        peripheral?.delegate = nil
        peripheral = nil
        ackCharacteristic = nil
        dataCharacteristic = nil
        controlCharacteristic = nil
        callback?.onConnectionStateChanged(.disconnected)
    }

    public func discoverServices() {
        peripheral?.discoverServices([CBUUID(string: BleMeshConstants.serviceUUID)])
    }

    /// Derives the ATT MTU from the real link: `maximumWriteValueLength(for: .withResponse) + 3`.
    public func requestMtu(_ preferred: Int) -> Result<Void, Error> {
        guard let peripheral else {
            return .failure(NSError(domain: "BleGattClient", code: 11, userInfo: nil))
        }
        let writable = peripheral.maximumWriteValueLength(for: .withResponse)
        callback?.onMtuChanged(mtu: min(preferred, writable + BleTransferProtocolConstants.attOverhead))
        return .success(())
    }

    public func writeCharacteristic(uuid: String, value: Data) {
        guard let peripheral else { return }
        let target: CBCharacteristic?
        switch BleMeshConstants.canonicalUuid(uuid) {
        case BleMeshConstants.controlCharacteristicUUID:
            target = controlCharacteristic
        case BleMeshConstants.dataCharacteristicUUID:
            target = dataCharacteristic
        case BleMeshConstants.ackCharacteristicUUID:
            target = ackCharacteristic
        default:
            target = nil
        }
        guard let characteristic = target else {
            onWriteError?()
            return
        }
        peripheral.writeValue(value, for: characteristic, type: .withResponse)
    }

    public func enableAckNotifications() {
        guard let peripheral, let ackCharacteristic else { return }
        peripheral.setNotifyValue(true, for: ackCharacteristic)
    }

    public func setClientDataListener(_ listener: GattClientCallbackPort?) {
        if let listener { callback = listener }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        callback?.onConnectionStateChanged(.discovering)
        guard error == nil,
              let service = peripheral.services?.first(where: { BleMeshConstants.canonicalUuid($0.uuid.uuidString) == BleMeshConstants.serviceUUID }) else {
            callback?.onConnectionStateChanged(.disconnected)
            return
        }
        peripheral.discoverCharacteristics(nil, for: service)
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        for characteristic in service.characteristics ?? [] {
            let id = BleMeshConstants.canonicalUuid(characteristic.uuid.uuidString)
            if id == BleMeshConstants.ackCharacteristicUUID {
                ackCharacteristic = characteristic
            } else if id == BleMeshConstants.dataCharacteristicUUID {
                dataCharacteristic = characteristic
            } else if id == BleMeshConstants.controlCharacteristicUUID {
                controlCharacteristic = characteristic
            }
        }
        guard error == nil, ackCharacteristic != nil, dataCharacteristic != nil, controlCharacteristic != nil else {
            callback?.onConnectionStateChanged(.disconnected)
            return
        }
        callback?.onServicesDiscovered()
        _ = requestMtu(BleTransferProtocolConstants.maxMtu)
        // The link is ready only once the peer ACK notifications are subscribed
        // (see `didUpdateNotificationStateFor`); otherwise the first HELLO_ACK could be lost.
        enableAckNotifications()
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        guard BleMeshConstants.canonicalUuid(characteristic.uuid.uuidString) == BleMeshConstants.ackCharacteristicUUID else {
            return
        }
        if error == nil, characteristic.isNotifying {
            callback?.onConnectionStateChanged(.ready)
        } else {
            callback?.onConnectionStateChanged(.disconnected)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if error != nil {
            onWriteError?()
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, let data = characteristic.value else { return }
        callback?.onCharacteristicChanged(uuid: BleMeshConstants.canonicalUuid(characteristic.uuid.uuidString), value: data)
    }
}
