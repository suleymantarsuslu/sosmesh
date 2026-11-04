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
    private var hasReceivedInitialPath = false
    private var uploadTasks: [String: Task<Void, Never>] = [:]
    private var retryWorkItem: DispatchWorkItem?
    
    public var onStatusChange: ((String, AttachmentUploadStatus) -> Void)?
    
    public init(queue: AttachmentQueue, baseURL: String) {
        self.queue = queue
        self.baseURL = baseURL
        
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }
            self.hasReceivedInitialPath = true
            let connected = path.status == .satisfied
            let wasDisconnected = !self.isConnected
            self.isConnected = connected
            
            if connected && wasDisconnected {
                Task { await self.processQueue() }
            }
        }
        monitor.start(queue: DispatchQueue.global(qos: .background))
    }
    
    deinit {
        monitor.cancel()
        retryWorkItem?.cancel()
    }
    
    public func start() {
        Task {
            try? await Task.sleep(nanoseconds: 500_000_000)
            await processQueue()
        }
    }
    
    public func processQueue() async {
        let pending = queue.listPending().filter { $0.uploadToken != nil }
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
    
    public func processSosAttachments(sosId: String) async {
        let attachments = queue.listBySosId(sosId).filter { $0.uploadToken != nil }
        for attachment in attachments {
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
        guard let uploadToken = attachment.uploadToken else {
            return
        }
        
        if !hasReceivedInitialPath {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
        }
        
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: attachment.dataPath)) else {
            notifyStatus(attachment.id, .failed(NSError(domain: "AttachmentUpload", code: 1)))
            try? queue.dequeue(id: attachment.id)
            return
        }
        
        if !validateAttachmentSize(data: data, kind: attachment.kind) {
            let error = NSError(
                domain: "AttachmentUpload",
                code: 413,
                userInfo: [NSLocalizedDescriptionKey: "Attachment exceeds size limit"]
            )
            notifyStatus(attachment.id, .failed(error))
            try? queue.dequeue(id: attachment.id)
            return
        }
        
        notifyStatus(attachment.id, .uploading)
        
        let config = AttachmentUploadConfig(baseURL: baseURL, uploadToken: uploadToken)
        let uploader = AttachmentUploader(config: config)
        
        let kind: AttachmentKind = attachment.kind == "audio" ? .audio : .image
        let result = await uploader.upload(kind: kind, data: data, mimeType: attachment.mimeType)
        
        switch result {
        case .success:
            notifyStatus(attachment.id, .sent)
            try? queue.dequeue(id: attachment.id)
            
        case .noNetwork:
            notifyStatus(attachment.id, .waiting)
            scheduleRetry()
            
        case .httpError(let code, let message, let retryAfterSeconds):
            let error = NSError(domain: "AttachmentUpload", code: code, userInfo: [NSLocalizedDescriptionKey: message])
            notifyStatus(attachment.id, .failed(error))
            if code >= 400 && code < 500 {
                if code == 429, let retryAfter = retryAfterSeconds {
                    scheduleRetry(after: TimeInterval(retryAfter))
                } else {
                    try? queue.dequeue(id: attachment.id)
                }
            } else if code == 503, let retryAfter = retryAfterSeconds {
                scheduleRetry(after: TimeInterval(retryAfter))
            } else {
                scheduleRetry()
            }

        case .error(let message):
            let error = NSError(domain: "AttachmentUpload", code: 0, userInfo: [NSLocalizedDescriptionKey: message])
            notifyStatus(attachment.id, .failed(error))
            scheduleRetry()
        }
    }
    
    private func validateAttachmentSize(data: Data, kind: String) -> Bool {
        let sizeInMB = Double(data.count) / (1024 * 1024)
        
        if kind == "audio" {
            return sizeInMB <= 50
        } else {
            return sizeInMB <= 15
        }
    }
    
    private func scheduleRetry(after delay: TimeInterval = 30) {
        retryWorkItem?.cancel()
        let workItem = DispatchWorkItem { [weak self] in
            Task {
                await self?.processQueue()
            }
        }
        retryWorkItem = workItem
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + delay, execute: workItem)
    }
    
    private func notifyStatus(_ id: String, _ status: AttachmentUploadStatus) {
        Task { @MainActor in
            onStatusChange?(id, status)
        }
    }
}
