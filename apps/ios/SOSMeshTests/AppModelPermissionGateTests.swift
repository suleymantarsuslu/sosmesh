import XCTest
@testable import SOSMesh
import SOSMeshCore

@MainActor
final class AppModelPermissionGateTests: XCTestCase {
    func testBootstrapDoesNotPrimeBluetoothWhenNotDetermined() {
        let probe = RecordingAppPermissionProbe(
            snapshot: PermissionGateSnapshot(
                bluetoothAuthorization: .notDetermined,
                bluetoothPoweredOn: false,
                notificationAuthorization: .notDetermined
            )
        )
        let model = AppModel(permissionProbe: probe)
        model.bootstrap()
        XCTAssertEqual(probe.primeBluetoothCount, 0)
        XCTAssertEqual(probe.primeIfAuthorizedCount, 0)
    }
    
    func testBootstrapPrimesBluetoothWhenAlreadyAuthorized() {
        let probe = RecordingAppPermissionProbe(
            snapshot: PermissionGateSnapshot(
                bluetoothAuthorization: .allowed,
                bluetoothPoweredOn: true,
                notificationAuthorization: .authorized
            )
        )
        let model = AppModel(permissionProbe: probe)
        model.bootstrap()
        XCTAssertEqual(probe.primeBluetoothCount, 1)
        XCTAssertEqual(probe.primeIfAuthorizedCount, 1)
    }

    func testRefreshPermissionGateDoesNotPrimeBluetooth() async {
        let probe = RecordingAppPermissionProbe(
            snapshot: PermissionGateSnapshot(
                bluetoothAuthorization: .notDetermined,
                bluetoothPoweredOn: false,
                notificationAuthorization: .notDetermined
            )
        )
        let model = AppModel(permissionProbe: probe)
        await model.refreshPermissionGate()
        XCTAssertEqual(probe.primeBluetoothCount, 0)
        XCTAssertEqual(probe.primeIfAuthorizedCount, 0)
    }

    func testGateBlockedUntilBluetoothAndNotificationsGranted() async {
        let blocked = PermissionGateSnapshot(
            bluetoothAuthorization: .notDetermined,
            bluetoothPoweredOn: false,
            notificationAuthorization: .notDetermined
        )
        let model = AppModel(permissionProbe: StubAppPermissionProbe(snapshot: blocked))
        await model.refreshPermissionGate()
        XCTAssertFalse(model.permissionGateCleared)
        if case .blocked(let step, _) = model.permissionGateStatus {
            XCTAssertEqual(step, .bluetooth)
        } else {
            XCTFail("Expected blocked gate")
        }
    }

    func testGateBlockedWhenBluetoothDeniedNeedsSettings() async {
        let denied = PermissionGateSnapshot(
            bluetoothAuthorization: .denied,
            bluetoothPoweredOn: false,
            notificationAuthorization: .authorized
        )
        let model = AppModel(permissionProbe: StubAppPermissionProbe(snapshot: denied))
        await model.refreshPermissionGate()
        XCTAssertFalse(model.permissionGateCleared)
        if case .blocked(let step, let reason) = model.permissionGateStatus {
            XCTAssertEqual(step, .bluetooth)
            XCTAssertEqual(reason, .denied)
        } else {
            XCTFail("Expected blocked gate")
        }
        XCTAssertTrue(PermissionGateEvaluator.needsOpenSettings(model.permissionGateStatus))
    }

    func testGateClearsWhenRequiredPermissionsGranted() async throws {
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("gate-clear-outbox-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tmp) }

        let cleared = PermissionGateSnapshot(
            bluetoothAuthorization: .allowed,
            bluetoothPoweredOn: true,
            notificationAuthorization: .authorized
        )
        let stubRadio = StubBleMeshRadioBox()
        let model = AppModel(
            permissionProbe: StubAppPermissionProbe(snapshot: cleared),
            outboxStorePath: tmp.path,
            meshRadioFactory: { outbox, _ in
                stubRadio.attachOutbox(outbox)
                return stubRadio
            }
        )
        await model.refreshPermissionGate()
        XCTAssertTrue(model.permissionGateCleared)
        XCTAssertEqual(model.permissionGateStatus, .cleared)
        XCTAssertTrue(stubRadio.startDiscoveryCalled)
    }

    func testRequestBluetoothStepPrimesAuthorization() async {
        let probe = RecordingAppPermissionProbe(
            snapshot: PermissionGateSnapshot(
                bluetoothAuthorization: .notDetermined,
                bluetoothPoweredOn: false,
                notificationAuthorization: .notDetermined
            )
        )
        let model = AppModel(permissionProbe: probe)
        await model.refreshPermissionGate()
        await model.requestPermissionForActiveGateStep()
        XCTAssertEqual(probe.primeBluetoothCount, 1)
    }

    func testOnPermissionGateVisiblePrimesOnlyWhenAlreadyAuthorized() {
        let probe = RecordingAppPermissionProbe(
            snapshot: PermissionGateSnapshot(
                bluetoothAuthorization: .allowed,
                bluetoothPoweredOn: true,
                notificationAuthorization: .authorized
            )
        )
        let model = AppModel(permissionProbe: probe)
        model.onPermissionGateBecameVisible()
        XCTAssertEqual(probe.primeBluetoothCount, 1)
        XCTAssertEqual(probe.primeIfAuthorizedCount, 1)
    }

    func testOnPermissionGateVisibleDoesNotPrimeWhenBluetoothNotDetermined() {
        let probe = RecordingAppPermissionProbe(
            snapshot: PermissionGateSnapshot(
                bluetoothAuthorization: .notDetermined,
                bluetoothPoweredOn: false,
                notificationAuthorization: .notDetermined
            )
        )
        let model = AppModel(permissionProbe: probe)
        model.onPermissionGateBecameVisible()
        XCTAssertEqual(probe.primeBluetoothCount, 0)
        XCTAssertEqual(probe.primeIfAuthorizedCount, 0)
    }
}

@MainActor
private final class RecordingAppPermissionProbe: AppPermissionProbing {
    var onGateRefreshRequested: (() -> Void)?
    var snapshot: PermissionGateSnapshot
    private(set) var primeBluetoothCount = 0
    private(set) var primeIfAuthorizedCount = 0

    init(snapshot: PermissionGateSnapshot) {
        self.snapshot = snapshot
    }

    func captureSnapshot() async -> PermissionGateSnapshot { snapshot }

    func primeBluetoothAuthorization() {
        primeBluetoothCount += 1
    }

    func primeBluetoothAuthorizationIfAlreadyAuthorized() {
        guard snapshot.bluetoothAuthorization == .allowed else { return }
        primeIfAuthorizedCount += 1
        primeBluetoothAuthorization()
    }

    func requestNotifications() async {}
}

@MainActor
private final class StubBleMeshRadioBox: BleMeshRadioPort {
    private var engineHolder: BleTransferEngine?
    private(set) var startDiscoveryCalled = false

    var transferEngine: BleTransferEngine {
        guard let engineHolder else {
            fatalError("Stub radio not configured")
        }
        return engineHolder
    }

    func attachOutbox(_ outbox: SosOutboxService) {
        let tracker = SosPeerDeliveryTracker(outbox: outbox)
        engineHolder = BleTransferEngine(
            serverOutbound: NoOpGattOutbound(),
            clientOutbound: NoOpGattOutbound(),
            peerDeliveryTracker: tracker
        )
    }

    func startDiscovery(role: BlePeerRole, relayEnabled: Bool, pendingSos: Bool) -> Result<Void, Error> {
        startDiscoveryCalled = true
        return .success(())
    }

    func stopDiscovery() {}

    func refreshSnapshot() -> BleRadioSnapshot {
        BleRadioSnapshot(
            authorization: .poweredOn,
            scanning: false,
            advertising: false,
            peerCount: 0,
            gattReady: false,
            statusMessage: "stub"
        )
    }

    func tick(nowMs: Int64) {}

    func connectFirstPeerIfNeeded() -> Result<Void, Error> { .success(()) }
}

private final class NoOpGattOutbound: GattOutboundWriting {
    func writeCharacteristic(uuid: String, value: Data) {}
}
