import CoreBluetooth
import Foundation
import SOSMeshCore
import UserNotifications

@MainActor
protocol AppPermissionProbing: AnyObject {
    var onGateRefreshRequested: (() -> Void)? { get set }
    func captureSnapshot() async -> PermissionGateSnapshot
    func primeBluetoothAuthorization()
    func primeBluetoothAuthorizationIfAlreadyAuthorized()
    func requestNotifications() async
}

@MainActor
final class LiveAppPermissionProbe: NSObject, AppPermissionProbing, CBCentralManagerDelegate {
    var onGateRefreshRequested: (() -> Void)?
    private var bluetoothWarmupManager: CBCentralManager?

    func captureSnapshot() async -> PermissionGateSnapshot {
        let notifications = await fetchNotificationAuthorization()
        let btState = bluetoothWarmupManager?.state ?? .unknown
        return PermissionGateSnapshot(
            bluetoothAuthorization: mapBluetoothAuthorization(CBManager.authorization),
            bluetoothPoweredOn: btState == .poweredOn,
            notificationAuthorization: notifications
        )
    }

    func primeBluetoothAuthorization() {
        if bluetoothWarmupManager == nil {
            bluetoothWarmupManager = CBCentralManager(delegate: self, queue: .main, options: [
                CBCentralManagerOptionShowPowerAlertKey: false,
            ])
        }
    }

    func primeBluetoothAuthorizationIfAlreadyAuthorized() {
        guard CBManager.authorization == .allowedAlways else { return }
        primeBluetoothAuthorization()
    }

    func requestNotifications() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        onGateRefreshRequested?()
    }

    private func fetchNotificationAuthorization() async -> PermissionGateNotificationAuthorization {
        await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                continuation.resume(returning: self.mapNotificationSettings(settings))
            }
        }
    }

    private func mapNotificationSettings(_ settings: UNNotificationSettings) -> PermissionGateNotificationAuthorization {
        switch settings.authorizationStatus {
        case .notDetermined: return .notDetermined
        case .denied: return .denied
        case .authorized: return .authorized
        case .provisional: return .provisional
        case .ephemeral: return .ephemeral
        @unknown default: return .denied
        }
    }

    private func mapBluetoothAuthorization(_ auth: CBManagerAuthorization) -> PermissionGateBluetoothAuthorization {
        switch auth {
        case .allowedAlways: return .allowed
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unsupported
        }
    }
}

@MainActor
final class StubAppPermissionProbe: AppPermissionProbing {
    var onGateRefreshRequested: (() -> Void)?
    var snapshot: PermissionGateSnapshot

    init(snapshot: PermissionGateSnapshot) {
        self.snapshot = snapshot
    }

    func captureSnapshot() async -> PermissionGateSnapshot { snapshot }
    func primeBluetoothAuthorization() {}
    func primeBluetoothAuthorizationIfAlreadyAuthorized() {}
    func requestNotifications() async {}
}
