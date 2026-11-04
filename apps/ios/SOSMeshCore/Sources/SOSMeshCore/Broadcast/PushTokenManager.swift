import Foundation
import UIKit

public actor PushTokenManager {
    private let apiBaseUrl: String

    public init(apiBaseUrl: String) {
        self.apiBaseUrl = apiBaseUrl
    }

    public func registerToken(_ token: Data) async {
        let tokenString = token.map { String(format: "%02x", $0) }.joined()
        let deviceId = await UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString

        let payload: [String: String] = [
            "platform": "ios",
            "token": tokenString,
            "deviceId": deviceId
        ]

        guard let url = URL(string: "\(apiBaseUrl)/v1/device/push-tokens"),
              let jsonData = try? JSONSerialization.data(withJSONObject: payload) else {
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData

        _ = try? await URLSession.shared.data(for: request)
    }
}
