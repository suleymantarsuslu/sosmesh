import CoreBluetooth
import Foundation
import SOSMeshCore

public protocol BlePeripheralCoordinating: AnyObject {
    var restorationIdentifier: String { get }
    func makePeripheralManager(queue: DispatchQueue, options: [String: Any]?) -> CBPeripheralManager
}

public final class BlePeripheralCoordinator: NSObject, BlePeripheralCoordinating, CBPeripheralManagerDelegate {
    public let restorationIdentifier = BleMeshConstants.peripheralRestorationIdentifier
    private var peripheral: CBPeripheralManager?
    public var onPhaseChange: ((BleRestorationPhase) -> Void)?

    public override init() {
        super.init()
    }

    public func makePeripheralManager(queue: DispatchQueue, options: [String: Any]? = nil) -> CBPeripheralManager {
        var opts = options ?? [:]
        opts[CBPeripheralManagerOptionRestoreIdentifierKey] = restorationIdentifier
        let manager = CBPeripheralManager(delegate: self, queue: queue, options: opts)
        peripheral = manager
        return manager
    }

    @discardableResult
    public func startTransferService(on peripheral: CBPeripheralManager) -> [CBMutableCharacteristic] {
        let service = CBMutableService(type: CBUUID(string: BleMeshConstants.serviceUUID), primary: true)
        let control = CBMutableCharacteristic(
            type: CBUUID(string: BleMeshConstants.controlCharacteristicUUID),
            properties: [.read, .write],
            value: nil,
            permissions: [.readable, .writeable]
        )
        let data = CBMutableCharacteristic(
            type: CBUUID(string: BleMeshConstants.dataCharacteristicUUID),
            properties: [.write],
            value: nil,
            permissions: [.writeable]
        )
        let ack = CBMutableCharacteristic(
            type: CBUUID(string: BleMeshConstants.ackCharacteristicUUID),
            properties: [.read, .write, .notify],
            value: nil,
            permissions: [.readable, .writeable]
        )
        // Mesh v2 MESH_INFO (16 bytes, read). Value nil = served per read request.
        let meshInfo = CBMutableCharacteristic(
            type: CBUUID(string: MeshV2.meshInfoCharacteristicUUID),
            properties: [.read],
            value: nil,
            permissions: [.readable]
        )
        service.characteristics = [control, data, ack, meshInfo]
        peripheral.add(service)
        return [control, data, ack, meshInfo]
    }

    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        if peripheral.state == .poweredOn {
            onPhaseChange?(.readyForeground)
        }
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, willRestoreState dict: [String: Any]) {
        onPhaseChange?(.restoringFromSystem)
    }
}
