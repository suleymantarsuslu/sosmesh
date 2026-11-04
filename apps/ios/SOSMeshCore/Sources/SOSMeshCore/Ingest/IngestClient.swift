import Foundation

public struct IngestRelayInfo: Codable {
    public let relayId: String
    public let hopCount: Int
    public let relayTimestamp: String
    
    public init(relayId: String, hopCount: Int, relayTimestamp: String) {
        self.relayId = relayId
        self.hopCount = hopCount
        self.relayTimestamp = relayTimestamp
    }
}

public struct IngestTransport: Codable {
    public let ttlSeconds: Int
    public let packetHash: String
    
    public init(ttlSeconds: Int, packetHash: String) {
        self.ttlSeconds = ttlSeconds
        self.packetHash = packetHash
    }
}

public struct IngestRequest: Codable {
    public let sosMessage: [String: AnyCodable]
    public let relayInfo: IngestRelayInfo
    public let transport: IngestTransport
    
    public init(sosMessage: [String: AnyCodable], relayInfo: IngestRelayInfo, transport: IngestTransport) {
        self.sosMessage = sosMessage
        self.relayInfo = relayInfo
        self.transport = transport
    }
}

public struct ServerAcceptedReceipt: Codable {
    public let ackType: String
    public let messageId: String
    public let packetHash: String
    public let timestamp: String
    public let signature: String
    public let uploadToken: String?

    public init(ackType: String, messageId: String, packetHash: String, timestamp: String, signature: String, uploadToken: String?) {
        self.ackType = ackType
        self.messageId = messageId
        self.packetHash = packetHash
        self.timestamp = timestamp
        self.signature = signature
        self.uploadToken = uploadToken
    }
}

public struct IngestResponse: Codable {
    public let receipt: ServerAcceptedReceipt
}

public enum IngestResult {
    case success(ServerAcceptedReceipt)
    case noNetwork
    case httpError(Int, String, retryAfterSeconds: Int?)
    case invalidReceipt
    case decodingError(Error)
}

public protocol IngestClientPort {
    func upload(request: IngestRequest) async -> IngestResult
}

public final class IngestClient: IngestClientPort {
    private let baseURL: String
    private let session: URLSession
    
    public init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }
    
    public func upload(request: IngestRequest) async -> IngestResult {
        guard let url = URL(string: "\(baseURL)/v1/ingest") else {
            return .httpError(0, "Invalid URL")
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let encoder = JSONEncoder()
        guard let body = try? encoder.encode(request) else {
            return .httpError(0, "Failed to encode request")
        }
        urlRequest.httpBody = body
        
        do {
            let (data, response) = try await session.data(for: urlRequest)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                return .httpError(0, "Invalid response")
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let message = String(data: data, encoding: .utf8) ?? "Unknown error"
                let retryAfter = parseRetryAfter(from: httpResponse, statusCode: httpResponse.statusCode)
                return .httpError(httpResponse.statusCode, message, retryAfterSeconds: retryAfter)
            }
            
            let decoder = JSONDecoder()
            let ingestResponse = try decoder.decode(IngestResponse.self, from: data)
            return .success(ingestResponse.receipt)
        } catch {
            if let urlError = error as? URLError {
                switch urlError.code {
                case .notConnectedToInternet, .networkConnectionLost, .cannotConnectToHost:
                    return .noNetwork
                default:
                    return .httpError(0, urlError.localizedDescription, retryAfterSeconds: nil)
                }
            }
            return .decodingError(error)
        }
    }
    
    private func parseRetryAfter(from response: HTTPURLResponse, statusCode: Int) -> Int? {
        guard statusCode == 429 || statusCode == 503 else { return nil }
        guard let retryAfterValue = response.value(forHTTPHeaderField: "Retry-After") else { return nil }
        
        if let seconds = Int(retryAfterValue) {
            return seconds
        }
        
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        if let date = formatter.date(from: retryAfterValue) {
            let interval = date.timeIntervalSinceNow
            return max(0, Int(interval))
        }
        
        return nil
    }
}

public struct AnyCodable: Codable {
    public let value: Any
    
    public init(_ value: Any) {
        self.value = value
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if container.decodeNil() {
            value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let number as NSNumber:
            // JSONSerialization yields NSNumber; `as Bool` would turn 0/1 into false/true
            // (version 1 -> true), which the server rejects. Only real booleans stay booleans.
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                try container.encode(number.boolValue)
            } else if CFNumberIsFloatType(number) {
                try container.encode(number.doubleValue)
            } else {
                try container.encode(number.int64Value)
            }
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }
}
