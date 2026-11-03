import XCTest
@testable import SOSMesh
import SOSMeshCore

@MainActor
final class AppModelPermissionGateTests: XCTestCase {
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

    func testGateClearsWhenRequiredPermissionsGranted() async {
        let cleared = PermissionGateSnapshot(
            bluetoothAuthorization: .allowed,
            bluetoothPoweredOn: true,
            notificationAuthorization: .authorized
        )
        let model = AppModel(permissionProbe: StubAppPermissionProbe(snapshot: cleared))
        await model.refreshPermissionGate()
        XCTAssertTrue(model.permissionGateCleared)
        XCTAssertEqual(model.permissionGateStatus, .cleared)
    }
}
