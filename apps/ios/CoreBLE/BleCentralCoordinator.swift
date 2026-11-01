import CoreBluetooth
import Foundation
import SOSMeshCore

public protocol BleCentralCoordinating: AnyObject {
    var restorationIdentifier: String { get }
    func makeCentralManager(queue: DispatchQueue, options: [String: Any]?) -> CBCentralManager
}

public final class BleCentralCoordinator: NSObject, BleCentralCoordinating, CBCentralManagerDelegate {
    public let restorationIdentifier = BleMeshConstants.centralRestorationIdentifier
    private var central: CBCentralManager?
    public var onPhaseChange: ((BleRestorationPhase) -> Void)?

    public override init() {
        super.init()
    }

    public func makeCentralManager(queue: DispatchQueue, options: [String: Any]? = nil) -> CBCentralManager {
        var opts = options ?? [:]
        opts[CBCentralManagerOptionRestoreIdentifierKey] = restorationIdentifier
        opts[CBCentralManagerOptionShowPowerAlertKey] = false
        let manager = CBCentralManager(delegate: self, queue: queue, options: opts)
        central = manager
        return manager
    }

    public func scanForMeshPeers(_ central: CBCentralManager) {
        let services = [CBUUID(string: BleMeshConstants.serviceUUID)]
        central.scanForPeripherals(withServices: services, options: [
            CBCentralManagerScanOptionAllowDuplicatesKey: false,
        ])
    }

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            onPhaseChange?(.readyForeground)
        case .poweredOff:
            onPhaseChange?(.awaitingPowerOn)
        default:
            break
        }
    }

    public func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
        onPhaseChange?(.restoringFromSystem)
    }
}
