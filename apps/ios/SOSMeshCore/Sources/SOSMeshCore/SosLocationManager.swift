import Foundation
import CoreLocation

public enum SosLocationStatus: Sendable {
    case unknown
    case gps
    case manual
}

public struct SosLocationSnapshot: Sendable {
    public let status: SosLocationStatus
    public let latitude: Double?
    public let longitude: Double?
    public let accuracy: Double?
    public let capturedAtMs: Int64?
    
    public init(status: SosLocationStatus, latitude: Double? = nil, longitude: Double? = nil, accuracy: Double? = nil, capturedAtMs: Int64? = nil) {
        self.status = status
        self.latitude = latitude
        self.longitude = longitude
        self.accuracy = accuracy
        self.capturedAtMs = capturedAtMs
    }
    
    public static var unknown: SosLocationSnapshot {
        SosLocationSnapshot(status: .unknown)
    }
}

public actor SosLocationManager: NSObject, CLLocationManagerDelegate {
    private let manager: CLLocationManager
    private var locationContinuation: CheckedContinuation<CLLocation?, Never>?
    private var timeoutTask: Task<Void, Never>?
    
    public override init() {
        manager = CLLocationManager()
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }
    
    public func requestLocationAsync(timeoutMs: Int64 = 5000) async -> SosLocationSnapshot {
        let authStatus = manager.authorizationStatus
        
        guard authStatus == .authorizedWhenInUse || authStatus == .authorizedAlways else {
            if authStatus == .notDetermined {
                manager.requestWhenInUseAuthorization()
            }
            return lastKnownLocationSnapshot() ?? .unknown
        }
        
        let location = await withCheckedContinuation { continuation in
            self.locationContinuation = continuation
            
            manager.requestLocation()
            
            self.timeoutTask = Task {
                try? await Task.sleep(nanoseconds: UInt64(timeoutMs * 1_000_000))
                if let cont = self.locationContinuation {
                    self.locationContinuation = nil
                    cont.resume(returning: nil)
                }
            }
        }
        
        timeoutTask?.cancel()
        timeoutTask = nil
        
        if let location = location {
            return mapToSnapshot(location)
        }
        
        return lastKnownLocationSnapshot() ?? .unknown
    }
    
    public func lastKnownLocationSnapshot() -> SosLocationSnapshot? {
        guard let location = manager.location else {
            return nil
        }
        
        let now = Date()
        let age = now.timeIntervalSince(location.timestamp)
        
        guard age < 300 else {
            return nil
        }
        
        return mapToSnapshot(location)
    }
    
    private func mapToSnapshot(_ location: CLLocation) -> SosLocationSnapshot {
        SosLocationSnapshot(
            status: .gps,
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracy: location.horizontalAccuracy,
            capturedAtMs: Int64(location.timestamp.timeIntervalSince1970 * 1000)
        )
    }
    
    nonisolated public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task {
            await handleLocationUpdate(locations)
        }
    }
    
    nonisolated public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task {
            await handleLocationError(error)
        }
    }
    
    private func handleLocationUpdate(_ locations: [CLLocation]) {
        guard let location = locations.first else { return }
        
        if let continuation = locationContinuation {
            locationContinuation = nil
            continuation.resume(returning: location)
        }
    }
    
    private func handleLocationError(_ error: Error) {
        if let continuation = locationContinuation {
            locationContinuation = nil
            continuation.resume(returning: nil)
        }
    }
}
