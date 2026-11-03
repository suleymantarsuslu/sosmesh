import XCTest
@testable import SOSMeshCore

final class PermissionGateEvaluatorTests: XCTestCase {
    func testAllGrantedAndBluetoothOn_clearsGate() {
        let snapshot = PermissionGateSnapshot(
            bluetoothAuthorization: .allowed,
            bluetoothPoweredOn: true,
            notificationAuthorization: .authorized
        )
        XCTAssertEqual(PermissionGateEvaluator.evaluate(snapshot), .cleared)
        XCTAssertTrue(PermissionGateEvaluator.isCleared(.cleared))
    }

    func testBluetoothNotDetermined_blocksBluetoothStep() {
        let snapshot = PermissionGateSnapshot(
            bluetoothAuthorization: .notDetermined,
            bluetoothPoweredOn: true,
            notificationAuthorization: .authorized
        )
        XCTAssertEqual(
            PermissionGateEvaluator.evaluate(snapshot),
            .blocked(step: .bluetooth, reason: .notDetermined)
        )
    }

    func testBluetoothDenied_blocksAndNeedsSettings() {
        let snapshot = PermissionGateSnapshot(
            bluetoothAuthorization: .denied,
            bluetoothPoweredOn: true,
            notificationAuthorization: .authorized
        )
        let status = PermissionGateEvaluator.evaluate(snapshot)
        XCTAssertEqual(status, .blocked(step: .bluetooth, reason: .denied))
        XCTAssertTrue(PermissionGateEvaluator.needsOpenSettings(status))
    }

    func testBluetoothAuthorizedButPoweredOff_blocksPoweredOff() {
        let snapshot = PermissionGateSnapshot(
            bluetoothAuthorization: .allowed,
            bluetoothPoweredOn: false,
            notificationAuthorization: .authorized
        )
        let status = PermissionGateEvaluator.evaluate(snapshot)
        XCTAssertEqual(status, .blocked(step: .bluetooth, reason: .bluetoothPoweredOff))
        XCTAssertFalse(PermissionGateEvaluator.needsOpenSettings(status))
    }

    func testNotificationsDenied_blocksNotificationsStep() {
        let snapshot = PermissionGateSnapshot(
            bluetoothAuthorization: .allowed,
            bluetoothPoweredOn: true,
            notificationAuthorization: .denied
        )
        let status = PermissionGateEvaluator.evaluate(snapshot)
        XCTAssertEqual(status, .blocked(step: .notifications, reason: .denied))
        XCTAssertTrue(PermissionGateEvaluator.needsOpenSettings(status))
    }

    func testProvisionalNotifications_passesGate() {
        let snapshot = PermissionGateSnapshot(
            bluetoothAuthorization: .allowed,
            bluetoothPoweredOn: true,
            notificationAuthorization: .provisional
        )
        XCTAssertEqual(PermissionGateEvaluator.evaluate(snapshot), .cleared)
    }
}
