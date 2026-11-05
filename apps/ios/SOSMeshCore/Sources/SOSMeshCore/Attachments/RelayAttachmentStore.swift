import Foundation

/// Relay side: opaque encrypted attachment copies received over BLE, kept as files until the relay has the SOS
/// upload token. Bounded (4 per SOS, 24 MB total, oldest evicted first, 72 h). Never decrypted here.
public final class RelayAttachmentStore: @unchecked Sendable {
    private static let maxTotalBytes = 24 * 1024 * 1024
    private static let staleSeconds: TimeInterval = 72 * 3600
    private let root: URL
    private let lock = NSLock()
    private let fm = FileManager.default

    public init(directory: URL) {
        root = directory.appendingPathComponent("relay_attachments", isDirectory: true)
        try? fm.createDirectory(at: root, withIntermediateDirectories: true)
    }

    private func dir(for sosId: String) -> URL {
        let safe = String(sosId.unicodeScalars.filter { $0.isASCII && ($0.properties.isAlphabetic || ("0" ... "9").contains(Character($0)) || $0 == "-" || $0 == "_") }.prefix(80))
        return root.appendingPathComponent(safe.isEmpty ? "x" : safe, isDirectory: true)
    }

    private func attFiles(in dir: URL) -> [URL] {
        ((try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []).filter { $0.pathExtension == "att" }
    }

    @discardableResult
    public func save(_ payload: Data) -> BleAttachmentWire.Parsed? {
        guard let parsed = BleAttachmentWire.decode(payload) else { return nil }
        lock.lock(); defer { lock.unlock() }
        let folder = dir(for: parsed.sosId)
        try? fm.createDirectory(at: folder, withIntermediateDirectories: true)
        let target = folder.appendingPathComponent("\(parsed.attachmentId).att")
        if fm.fileExists(atPath: target.path) { return parsed }
        if attFiles(in: folder).count >= BleAttachmentWire.maxAttachmentsPerSos { return nil }
        evictToFit(incoming: payload.count)
        do { try payload.write(to: target, options: .atomic) } catch { return nil }
        return parsed
    }

    public func setUploadToken(_ token: String, sosId: String) {
        lock.lock(); defer { lock.unlock() }
        let folder = dir(for: sosId)
        try? fm.createDirectory(at: folder, withIntermediateDirectories: true)
        try? Data(token.utf8).write(to: folder.appendingPathComponent("token"), options: .atomic)
    }

    public func uploadToken(sosId: String) -> String? {
        lock.lock(); defer { lock.unlock() }
        guard let data = try? Data(contentsOf: dir(for: sosId).appendingPathComponent("token")),
              let token = String(data: data, encoding: .utf8), !token.isEmpty else { return nil }
        return token
    }

    public func pendingFiles(sosId: String) -> [URL] {
        lock.lock(); defer { lock.unlock() }
        return attFiles(in: dir(for: sosId)).sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    /// Stored sos ids that hold a token and at least one copy (retry set).
    public func sosIdsReadyForUpload() -> [String] {
        lock.lock(); defer { lock.unlock() }
        let folders = (try? fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
        return folders.filter { fm.fileExists(atPath: $0.appendingPathComponent("token").path) && !attFiles(in: $0).isEmpty }
            .map(\.lastPathComponent)
    }

    public func delete(_ file: URL) {
        lock.lock(); defer { lock.unlock() }
        try? fm.removeItem(at: file)
    }

    private func evictToFit(incoming: Int) {
        let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey]
        var files: [(url: URL, date: Date, size: Int)] = []
        for folder in (try? fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? [] {
            if let date = (try? folder.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate,
               Date().timeIntervalSince(date) > Self.staleSeconds {
                try? fm.removeItem(at: folder)
                continue
            }
            for file in attFiles(in: folder) {
                let values = try? file.resourceValues(forKeys: Set(keys))
                files.append((file, values?.contentModificationDate ?? .distantPast, values?.fileSize ?? 0))
            }
        }
        files.sort { $0.date < $1.date }
        var total = files.reduce(incoming) { $0 + $1.size }
        while total > Self.maxTotalBytes, !files.isEmpty {
            let oldest = files.removeFirst()
            total -= oldest.size
            try? fm.removeItem(at: oldest.url)
        }
    }
}

/// Uploads carried attachment copies to `POST /v1/device/attachments/relayed` (multipart) with the upload token of
/// the relay's own SOS ingest. Permanent 4xx drops the copy; network / 5xx / 429 keeps it for the next cycle.
public final class RelayAttachmentUploader: @unchecked Sendable {
    private let store: RelayAttachmentStore
    private let baseURL: String
    private let lock = NSLock()
    private var running = false

    public init(store: RelayAttachmentStore, baseURL: String) {
        self.store = store
        self.baseURL = baseURL
    }

    /// The relay got a token for this SOS: remember it and send everything already stored.
    public func onSosUploaded(sosId: String, uploadToken: String?) async {
        guard let uploadToken, !uploadToken.isEmpty else { return }
        store.setUploadToken(uploadToken, sosId: sosId)
        await upload(sosId: sosId)
    }

    /// A copy arrived (possibly after the SOS itself was already uploaded).
    public func onAttachmentStored(sosId: String) async {
        if store.uploadToken(sosId: sosId) != nil { await upload(sosId: sosId) }
    }

    public func retryAll() async {
        for sosId in store.sosIdsReadyForUpload() { await upload(sosId: sosId) }
    }

    private func upload(sosId: String) async {
        guard beginRun() else { return }
        defer { endRun() }
        guard let token = store.uploadToken(sosId: sosId),
              let url = URL(string: "\(baseURL)/v1/device/attachments/relayed") else { return }
        for file in store.pendingFiles(sosId: sosId) {
            guard let data = try? Data(contentsOf: file), let parsed = BleAttachmentWire.decode(data) else {
                store.delete(file)
                continue
            }
            switch await post(url: url, token: token, parsed: parsed) {
            case .done, .rejected: store.delete(file)
            case .retry: return
            }
        }
    }

    private func beginRun() -> Bool {
        lock.lock(); defer { lock.unlock() }
        if running { return false }
        running = true
        return true
    }

    private func endRun() {
        lock.lock(); defer { lock.unlock() }
        running = false
    }

    private enum Outcome { case done, rejected, retry }

    private func post(url: URL, token: String, parsed: BleAttachmentWire.Parsed) async -> Outcome {
        let boundary = UUID().uuidString
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(token, forHTTPHeaderField: "x-upload-token")
        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
        }
        field("kind", parsed.kind)
        field("attachmentId", parsed.attachmentId)
        field("nonce", parsed.nonce)
        field("ephemeralPublicKey", parsed.ephemeralPublicKey)
        field("keyId", parsed.keyId)
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(parsed.attachmentId).bin\"\r\nContent-Type: application/octet-stream\r\n\r\n".utf8))
        body.append(parsed.ciphertext)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        request.httpBody = body
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return .retry }
            switch http.statusCode {
            case 200 ..< 300: return .done
            case 429: return .retry
            case 400 ..< 500: return .rejected
            default: return .retry
            }
        } catch {
            return .retry
        }
    }
}
