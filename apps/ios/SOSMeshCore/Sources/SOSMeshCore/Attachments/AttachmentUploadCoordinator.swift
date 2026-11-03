import Foundation
import Network

public enum AttachmentUploadStatus {
    case waiting
    case uploading
    case sent
    case failed(Error)
}

public final class AttachmentUploadCoordinator {
    private let queue: AttachmentQueue
    private let baseURL: String
    private let monitor = NWPathMonitor()
    private var isConnected = false
    private var uploadTasks: [String: Task<Void, Never>] = [:]
    
    public var onStatusChange: ((String, AttachmentUploadStatus) -> Void)?
    
    public init(queue: AttachmentQueue, baseURL: String) {
        self.queue = queue
        self.baseURL = baseURL
        
        monitor.pathUpdateHandler = { [weak self] path in
            let connected = path.status == .satisfied
            if connected && !self!.isConnected {
                Task { await self?.processQueue() }
            }
            self?.isConnected = connected
        }
        monitor.start(queue: DispatchQueue.global(qos: .background))
    }
    
    public func processQueue() async {
        let pending = queue.listPending()
        for attachment in pending {
            if uploadTasks[attachment.id] != nil {
                continue
            }
            
            let task = Task {
                await uploadAttachment(attachment)
            }
            uploadTasks[attachment.id] = task
            await task.value
            uploadTasks.removeValue(forKey: attachment.id)
        }
    }
    
    private func uploadAttachment(_ attachment: QueuedAttachment) async {
        guard isConnected else {
            notifyStatus(attachment.id, .waiting)
            return
        }
        
        notifyStatus(attachment.id, .uploading)
        
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: attachment.dataPath)) else {
            notifyStatus(attachment.id, .failed(NSError(domain: "AttachmentUpload", code: 1)))
            try? queue.dequeue(id: attachment.id)
            return
        }
        
        let config = AttachmentUploadConfig(baseURL: baseURL, uploadToken: attachment.uploadToken)
        let uploader = AttachmentUploader(config: config)
        
        let kind: AttachmentKind = attachment.kind == "audio" ? .audio : .image
        let result = await uploader.upload(kind: kind, data: data, mimeType: attachment.mimeType)
        
        switch result {
        case .success:
            notifyStatus(attachment.id, .sent)
            try? queue.dequeue(id: attachment.id)
            
        case .noNetwork:
            notifyStatus(attachment.id, .waiting)
            
        case .httpError(let code, let message):
            let error = NSError(domain: "AttachmentUpload", code: code, userInfo: [NSLocalizedDescriptionKey: message])
            notifyStatus(attachment.id, .failed(error))
            if code >= 400 && code < 500 {
                try? queue.dequeue(id: attachment.id)
            }

        case .error(let message):
            let error = NSError(domain: "AttachmentUpload", code: 0, userInfo: [NSLocalizedDescriptionKey: message])
            notifyStatus(attachment.id, .failed(error))
        }
    }
    
    private func notifyStatus(_ id: String, _ status: AttachmentUploadStatus) {
        Task { @MainActor in
            onStatusChange?(id, status)
        }
    }
}
