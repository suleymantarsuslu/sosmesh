import Foundation

public protocol ReceiptLookupPort: AnyObject {
    /// Verified tombstones for already accepted packets. Empty on any error or an old server (404).
    func lookup(items: [(messageId: String, packetHash: String)], nowMs: Int64) async -> [DeliveryTombstone]
}

/// `POST /v1/receipts/lookup` (receipt-lookup-v2.schema.json). Callers send messageId AND
/// packetHash; receipts are verified with the bundled key before use.
public final class ReceiptLookupClient: ReceiptLookupPort {
    private let baseURL: String
    private let session: URLSession
    private let verifier: TombstoneVerifier
    public var onHttpResponse: ((Int) -> Void)?

    public init(baseURL: String, receiptKeySpkiBase64: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        verifier = TombstoneVerifier(publicKeySpkiBase64: receiptKeySpkiBase64)
    }

    private struct Item: Encodable { let messageId: String; let packetHash: String }
    private struct Request: Encodable { let items: [Item] }
    private struct Response: Decodable { let receipts: [DeliveryTombstone] }

    public func lookup(items: [(messageId: String, packetHash: String)], nowMs: Int64) async -> [DeliveryTombstone] {
        guard !items.isEmpty, let url = URL(string: baseURL + "/v1/receipts/lookup") else { return [] }
        var request = URLRequest(url: url, timeoutInterval: 10)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(Request(items: items.prefix(64).map { Item(messageId: $0.messageId, packetHash: $0.packetHash) }))
        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse else { return [] }
        onHttpResponse?(http.statusCode)
        guard (200 ..< 300).contains(http.statusCode),
              let decoded = try? JSONDecoder().decode(Response.self, from: data) else { return [] }
        let wanted = Set(items.map { $0.messageId + "|" + $0.packetHash })
        return decoded.receipts.filter { wanted.contains($0.messageId + "|" + $0.packetHash) && verifier.verify($0, nowMs: nowMs) }
    }
}

/// `h = 0` needs a real HTTPS answer from the API (2xx or 4xx) within 60 s (§4.1).
public final class GatewayProbe: @unchecked Sendable {
    private let baseURL: String
    private let session: URLSession
    private var lastProbeMs: Int64 = 0
    private let lock = NSLock()
    public static let intervalMs: Int64 = 30_000

    public init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public func probeIfDue(nowMs: Int64, tracker: GatewayHopsTracker) async {
        lock.lock()
        guard nowMs - lastProbeMs >= GatewayProbe.intervalMs else { lock.unlock(); return }
        lastProbeMs = nowMs
        lock.unlock()
        guard let url = URL(string: baseURL + "/health") else { return }
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 5)
        if let (_, response) = try? await session.data(for: request),
           let http = response as? HTTPURLResponse, (200 ..< 500).contains(http.statusCode) {
            tracker.noteInternetSuccess(nowMs: Int64(Date().timeIntervalSince1970 * 1000))
        } else {
            tracker.noteInternetFailure()
        }
    }
}
