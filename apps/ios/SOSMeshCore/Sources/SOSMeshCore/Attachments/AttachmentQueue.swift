import Foundation

public struct QueuedAttachment: Codable {
    public let id: String
    public let sosMessageId: String
    public let uploadToken: String
    public let kind: String
    public let dataPath: String
    public let mimeType: String
    public let createdAt: Date
    
    public init(
        id: String,
        sosMessageId: String,
        uploadToken: String,
        kind: String,
        dataPath: String,
        mimeType: String,
        createdAt: Date
    ) {
        self.id = id
        self.sosMessageId = sosMessageId
        self.uploadToken = uploadToken
        self.kind = kind
        self.dataPath = dataPath
        self.mimeType = mimeType
        self.createdAt = createdAt
    }
}

public final class AttachmentQueue {
    private let queuePath: URL
    private let dataDir: URL
    private let fileManager = FileManager.default
    
    public init(baseDir: URL) throws {
        self.queuePath = baseDir.appendingPathComponent("attachment_queue.json")
        self.dataDir = baseDir.appendingPathComponent("attachments")
        try fileManager.createDirectory(at: dataDir, withIntermediateDirectories: true)
    }
    
    public func enqueue(
        sosMessageId: String,
        uploadToken: String,
        kind: AttachmentKind,
        data: Data,
        mimeType: String
    ) throws -> QueuedAttachment {
        let id = UUID().uuidString
        let filename = "\(id).\(fileExtension(for: mimeType))"
        let dataPath = dataDir.appendingPathComponent(filename)
        
        try data.write(to: dataPath)
        
        let attachment = QueuedAttachment(
            id: id,
            sosMessageId: sosMessageId,
            uploadToken: uploadToken,
            kind: kind.rawValue,
            dataPath: dataPath.path,
            mimeType: mimeType,
            createdAt: Date()
        )
        
        var queue = loadQueue()
        queue.append(attachment)
        try saveQueue(queue)
        
        return attachment
    }
    
    public func dequeue(id: String) throws {
        var queue = loadQueue()
        if let index = queue.firstIndex(where: { $0.id == id }) {
            let attachment = queue[index]
            queue.remove(at: index)
            try saveQueue(queue)
            
            let url = URL(fileURLWithPath: attachment.dataPath)
            try? fileManager.removeItem(at: url)
        }
    }
    
    public func listPending() -> [QueuedAttachment] {
        return loadQueue()
    }
    
    private func loadQueue() -> [QueuedAttachment] {
        guard fileManager.fileExists(atPath: queuePath.path),
              let data = try? Data(contentsOf: queuePath),
              let queue = try? JSONDecoder().decode([QueuedAttachment].self, from: data) else {
            return []
        }
        return queue
    }
    
    private func saveQueue(_ queue: [QueuedAttachment]) throws {
        let data = try JSONEncoder().encode(queue)
        try data.write(to: queuePath)
    }
    
    private func fileExtension(for mimeType: String) -> String {
        switch mimeType {
        case "image/jpeg", "image/jpg": return "jpg"
        case "image/png": return "png"
        case "image/webp": return "webp"
        case "audio/aac", "audio/x-m4a": return "m4a"
        default: return "bin"
        }
    }
}
