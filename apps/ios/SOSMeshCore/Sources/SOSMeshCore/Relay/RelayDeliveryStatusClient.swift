import Foundation

public protocol RelayDeliveryStatusPort: AnyObject {
    func checkDeliveryStatus(messageIds: [String]) async -> [String]
}

public final class RelayDeliveryStatusClient: RelayDeliveryStatusPort {
    private let baseURL: String
    private let session: URLSession
    
    public init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }
    
    private struct Request: Encodable {
        let messageIds: [String]
    }
    
    private struct Response: Decodable {
        let delivered: [String]
    }
    
    public func checkDeliveryStatus(messageIds: [String]) async -> [String] {
        guard !messageIds.isEmpty,
              let url = URL(string: baseURL + "/v1/device/relay/delivery-status") else {
            return []
        }
        
        var request = URLRequest(url: url, timeoutInterval: 10)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody = Request(messageIds: Array(messageIds.prefix(200)))
        guard let httpBody = try? JSONEncoder().encode(requestBody) else {
            return []
        }
        request.httpBody = httpBody
        
        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse,
              (200 ..< 300).contains(http.statusCode),
              let decoded = try? JSONDecoder().decode(Response.self, from: data) else {
            return []
        }
        
        return decoded.delivered
    }
}
