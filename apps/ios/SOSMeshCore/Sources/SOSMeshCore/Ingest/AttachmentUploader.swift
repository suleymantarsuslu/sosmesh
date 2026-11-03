import Foundation

public struct AttachmentUploadConfig {
    public let baseURL: String
    public let uploadToken: String
    
    public init(baseURL: String, uploadToken: String) {
        self.baseURL = baseURL
        self.uploadToken = uploadToken
    }
}

public enum AttachmentKind: String {
    case audio
    case image
}

public enum AttachmentUploadResult {
    case success(attachmentId: String)
    case noNetwork
    case httpError(Int, String)
    case error(String)
}

public final class AttachmentUploader {
    private let config: AttachmentUploadConfig
    
    public init(config: AttachmentUploadConfig) {
        self.config = config
    }
    
    public func upload(
        kind: AttachmentKind,
        data: Data,
        mimeType: String
    ) async -> AttachmentUploadResult {
        guard let url = URL(string: "\(config.baseURL)/v1/device/attachments") else {
            return .error("Invalid URL")
        }
        
        let boundary = UUID().uuidString
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(config.uploadToken, forHTTPHeaderField: "x-upload-token")
        
        var body = Data()
        
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"kind\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(kind.rawValue)\r\n".data(using: .utf8)!)
        
        let ext = mimeType.components(separatedBy: "/").last ?? "bin"
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"attachment.\(ext)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        do {
            let (responseData, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                return .error("Invalid response")
            }
            
            if httpResponse.statusCode == 201 {
                if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
                   let attachmentId = json["attachmentId"] as? String {
                    return .success(attachmentId: attachmentId)
                }
                return .success(attachmentId: "unknown")
            } else {
                let message = String(data: responseData, encoding: .utf8) ?? "Unknown error"
                return .httpError(httpResponse.statusCode, message)
            }
        } catch let error as URLError {
            if error.code == .notConnectedToInternet || error.code == .networkConnectionLost {
                return .noNetwork
            }
            return .error(error.localizedDescription)
        } catch {
            return .error(error.localizedDescription)
        }
    }
}
