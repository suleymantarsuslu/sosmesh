import CoreBluetooth
import CoreLocation
import Foundation
import SOSMeshCore
import UserNotifications

@MainActor
protocol AppPermissionProbing: AnyObject {
    func captureSnapshot() async -> PermissionGateSnapshot
    func primeBluetoothAuthorization()
    func requestNotifications() async
    func requestLocationWhenInUse()
}

@MainActor
final class LiveAppPermissionProbe: NSObject, AppPermissionProbing, CLLocationManagerDelegate {
    private var locationManager: CLLocationManager?
    private var bluetoothWarmupManager: CBCentralManager?

    func captureSnapshot() async -> PermissionGateSnapshot {
        let notifications = await fetchNotificationAuthorization()
        let btState = bluetoothWarmupManager?.state ?? .unknown
        return PermissionGateSnapshot(
            bluetoothAuthorization: mapBluetoothAuthorization(CBManager.authorization),
            bluetoothPoweredOn: btState == .poweredOn,
            notificationAuthorization: notifications,
            locationAuthorization: mapLocationAuthorization(
                locationManager?.authorizationStatus ?? CLLocationManager().authorizationStatus
            )
        )
    }

    func primeBluetoothAuthorization() {
        if bluetoothWarmupManager == nil {
            bluetoothWarmupManager = CBCentralManager(delegate: nil, queue: nil, options: [
                CBCentralManagerOptionShowPowerAlertKey: false,
            ])
        }
    }

    func requestNotifications() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
    }

    func requestLocationWhenInUse() {
        if locationManager == nil {
            let manager = CLLocationManager()
            manager.delegate = self
            locationManager = manager
        }
        locationManager?.requestWhenInUseAuthorization()
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

    private func mapLocationAuthorization(_ status: CLAuthorizationStatus) -> PermissionGateLocationAuthorization {
        switch status {
        case .notDetermined: return .notDetermined
        case .authorizedWhenInUse, .authorizedAlways: return .whenInUse
        case .denied: return .denied
        case .restricted: return .restricted
        @unknown default: return .denied
        }
    }
}

#if DEBUG
@MainActor
final class StubAppPermissionProbe: AppPermissionProbing {
    var snapshot: PermissionGateSnapshot

    init(snapshot: PermissionGateSnapshot) {
        self.snapshot = snapshot
    }

    func captureSnapshot() async -> PermissionGateSnapshot { snapshot }
    func primeBluetoothAuthorization() {}
    func requestNotifications() async {}
    func requestLocationWhenInUse() {}
}
#endif
