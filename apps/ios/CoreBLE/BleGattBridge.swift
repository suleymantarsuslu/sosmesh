import CoreBluetooth
import Foundation
import SOSMeshCore

public final class BleGattServerBridge: NSObject, GattServerPort, CBPeripheralManagerDelegate {
    private var peripheralManager: CBPeripheralManager?
    private var writeListener: GattServerWriteListener?
    private var characteristics: [String: CBMutableCharacteristic] = [:]
    private let queue = DispatchQueue(label: "com.sosmesh.ble.gatt-server")
    private var pendingAdvertisement: [String: Any]?
    private var serviceAdded = false

    public override init() {
        super.init()
    }

    public func attach(manager: CBPeripheralManager) {
        peripheralManager = manager
    }

    public func start() -> Result<Void, Error> {
        guard let peripheralManager else {
            return .failure(NSError(domain: "BleGattServer", code: 1, userInfo: [NSLocalizedDescriptionKey: "No peripheral manager"]))
        }
        if peripheralManager.state != .poweredOn {
            return .failure(NSError(domain: "BleGattServer", code: 2, userInfo: [NSLocalizedDescriptionKey: "Bluetooth not powered on"]))
        }
        let coordinator = BlePeripheralCoordinator()
        let createdCharacteristics = coordinator.startTransferService(on: peripheralManager)
        characteristics.removeAll()
        for characteristic in createdCharacteristics {
            characteristics[characteristic.uuid.uuidString.uppercased()] = characteristic
        }
        serviceAdded = true
        var advertisement: [String: Any] = [
            CBAdvertisementDataServiceUUIDsKey: [CBUUID(string: BleMeshConstants.serviceUUID)],
        ]
        peripheralManager.startAdvertising(advertisement)
        return .success(())
    }

    public func stop() {
        peripheralManager?.stopAdvertising()
        writeListener = nil
    }

    public func setWriteListener(_ listener: GattServerWriteListener?) {
        writeListener = listener
    }

    public func notifyCharacteristic(uuid: String, value: Data, deviceAddress: String?) -> Result<Void, Error> {
        guard let peripheralManager, let characteristic = characteristics[uuid.uppercased()] else {
            return .failure(NSError(domain: "BleGattServer", code: 3, userInfo: nil))
        }
        let ok = peripheralManager.updateValue(value, for: characteristic, onSubscribedCentrals: nil)
        return ok ? .success(()) : .failure(NSError(domain: "BleGattServer", code: 4, userInfo: nil))
    }

    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard peripheral.state == .poweredOn, let pendingAdvertisement, serviceAdded else {
            return
        }
        peripheral.startAdvertising(pendingAdvertisement)
        self.pendingAdvertisement = nil
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        for request in requests {
            let uuid = request.characteristic.uuid.uuidString
            let value = request.value ?? Data()
            writeListener?.onCharacteristicWrite(uuid: uuid, value: value, deviceAddress: "central")
            if request.characteristic.properties.contains(.write) {
                peripheral.respond(to: request, withResult: .success)
            }
        }
    }
}

public final class BleGattClientBridge: NSObject, GattClientPort, CBPeripheralDelegate {
    private weak var callback: GattClientCallbackPort?
    private var peripheral: CBPeripheral?
    private var ackCharacteristic: CBCharacteristic?
    private var dataCharacteristic: CBCharacteristic?
    private var controlCharacteristic: CBCharacteristic?
    private var pendingWrites: [(CBCharacteristic, Data)] = []

    public func connect(peerAddress: String, serviceUuid: String, callback: GattClientCallbackPort) -> Result<Void, Error> {
        self.callback = callback
        callback.onConnectionStateChanged(.connecting)
        return .failure(NSError(domain: "BleGattClient", code: 10, userInfo: [NSLocalizedDescriptionKey: "Use connect(peripheral:)"]))
    }

    public func connect(peripheral: CBPeripheral, callback: GattClientCallbackPort) {
        self.callback = callback
        self.peripheral = peripheral
        peripheral.delegate = self
        callback.onConnectionStateChanged(.connecting)
        peripheral.discoverServices([CBUUID(string: BleMeshConstants.serviceUUID)])
    }

    public func disconnect() {
        guard let peripheral else { return }
        peripheral.delegate = nil
        self.peripheral = nil
        callback?.onConnectionStateChanged(.disconnected)
    }

    public func discoverServices() {
        peripheral?.discoverServices([CBUUID(string: BleMeshConstants.serviceUUID)])
    }

    public func requestMtu(_ preferred: Int) -> Result<Void, Error> {
        callback?.onMtuChanged(mtu: min(preferred, 247))
        callback?.onConnectionStateChanged(.ready)
        return .success(())
    }

    public func writeCharacteristic(uuid: String, value: Data) {
        guard let peripheral else { return }
        let target: CBCharacteristic?
        switch uuid.uppercased() {
        case BleMeshConstants.controlCharacteristicUUID.uppercased():
            target = controlCharacteristic
        case BleMeshConstants.dataCharacteristicUUID.uppercased():
            target = dataCharacteristic
        case BleMeshConstants.ackCharacteristicUUID.uppercased():
            target = ackCharacteristic
        default:
            target = nil
        }
        guard let characteristic = target else { return }
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
        guard let service = peripheral.services?.first(where: { $0.uuid.uuidString.caseInsensitiveCompare(BleMeshConstants.serviceUUID) == .orderedSame }) else {
            return
        }
        peripheral.discoverCharacteristics(nil, for: service)
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        for characteristic in service.characteristics ?? [] {
            let id = characteristic.uuid.uuidString.uppercased()
            if id == BleMeshConstants.ackCharacteristicUUID.uppercased() {
                ackCharacteristic = characteristic
            } else if id == BleMeshConstants.dataCharacteristicUUID.uppercased() {
                dataCharacteristic = characteristic
            } else if id == BleMeshConstants.controlCharacteristicUUID.uppercased() {
                controlCharacteristic = characteristic
            }
        }
        callback?.onServicesDiscovered()
        _ = requestMtu(247)
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard let data = characteristic.value else { return }
        callback?.onCharacteristicChanged(uuid: characteristic.uuid.uuidString, value: data)
    }
}
