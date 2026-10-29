import Foundation

public struct Location: Codable, Equatable {
    public let latitude: Double
    public let longitude: Double
    public let accuracy: Double?
    
    public init(latitude: Double, longitude: Double, accuracy: Double? = nil) {
        self.latitude = latitude
        self.longitude = longitude
        self.accuracy = accuracy
    }
}

public struct Envelope: Codable, Equatable {
    public let timestamp: String
    public let location: Location
    public let priority: Int
    public let ackLevel: String
    public let relayCount: Int?
    
    public init(timestamp: String, location: Location, priority: Int, ackLevel: String, relayCount: Int? = nil) {
        self.timestamp = timestamp
        self.location = location
        self.priority = priority
        self.ackLevel = ackLevel
        self.relayCount = relayCount
    }
}

public struct SosMessage: Codable, Equatable {
    public let version: Int
    public let id: String
    public let envelope: Envelope
    public let encryptedPayload: String
    public let signature: String?
    
    public init(version: Int, id: String, envelope: Envelope, encryptedPayload: String, signature: String? = nil) {
        self.version = version
        self.id = id
        self.envelope = envelope
        self.encryptedPayload = encryptedPayload
        self.signature = signature
    }
}
