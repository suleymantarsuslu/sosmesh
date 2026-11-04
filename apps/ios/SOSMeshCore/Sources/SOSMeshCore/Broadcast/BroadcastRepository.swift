import CoreLocation
import Foundation

public actor BroadcastRepository {
    private let apiBaseUrl: String
    private let store: BroadcastStore
    private let verifier: BroadcastSignatureVerifier

    public init(apiBaseUrl: String, publicKeyBase64: String) throws {
        self.apiBaseUrl = apiBaseUrl
        self.store = BroadcastStore()
        self.verifier = try BroadcastSignatureVerifier(publicKeyBase64: publicKeyBase64)
    }

    public func fetchAndProcessBroadcasts(currentLocation: CLLocation?) async throws -> [ServerBroadcast] {
        let lastFetch = await store.getLastFetchTime() ?? Date().addingTimeInterval(-7 * 24 * 3600)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let sinceParam = formatter.string(from: lastFetch)

        guard let url = URL(string: "\(apiBaseUrl)/v1/device/broadcasts/active?since=\(sinceParam)") else {
            return []
        }

        let (data, _) = try await URLSession.shared.data(from: url)
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        var broadcasts: [ServerBroadcast] = []
        let now = Date()
        var maxCreatedAt: Date?

        for obj in json {
            guard let broadcast = parseBroadcast(obj) else { continue }

            if await store.isSeen(broadcast.id) { continue }

            let formatter = ISO8601DateFormatter()
            guard let expiresAt = formatter.date(from: broadcast.expiresAt),
                  expiresAt > now else { continue }

            guard verifier.verify(broadcast: broadcast) else { continue }

            if let regionLat = broadcast.regionLat, let regionLng = broadcast.regionLng,
               let regionRadiusKm = broadcast.regionRadiusKm {
                if let currentLocation = currentLocation {
                    let broadcastLocation = CLLocation(latitude: regionLat, longitude: regionLng)
                    let distanceKm = currentLocation.distance(from: broadcastLocation) / 1000.0
                    if distanceKm > regionRadiusKm { continue }
                }
            }

            broadcasts.append(broadcast)
            await store.markSeen(broadcast.id)

            if let createdAt = formatter.date(from: broadcast.createdAt) {
                if maxCreatedAt == nil || createdAt > maxCreatedAt! {
                    maxCreatedAt = createdAt
                }
            }
        }

        if let maxCreatedAt = maxCreatedAt {
            await store.updateLastFetchTime(maxCreatedAt)
        }

        return broadcasts
    }

    private func parseBroadcast(_ obj: [String: Any]) -> ServerBroadcast? {
        guard let id = obj["id"] as? String,
              let title = obj["title"] as? String,
              let body = obj["body"] as? String,
              let severity = obj["severity"] as? String,
              let createdAt = obj["createdAt"] as? String,
              let expiresAt = obj["expiresAt"] as? String,
              let signature = obj["signature"] as? String else {
            return nil
        }

        let regionLat = obj["regionLatitude"] as? Double
        let regionLng = obj["regionLongitude"] as? Double
        let regionRadiusKm = obj["regionRadiusKm"] as? Double

        return ServerBroadcast(
            id: id,
            title: title,
            body: body,
            severity: severity,
            createdAt: createdAt,
            expiresAt: expiresAt,
            regionLat: regionLat,
            regionLng: regionLng,
            regionRadiusKm: regionRadiusKm,
            signature: signature,
            hopsLeft: 8
        )
    }
}
