import Foundation
import SOSMeshContracts

/// One shrunk + encrypted attachment copy ready to travel as a BLE transfer payload (`BleAttachmentWire`).
public struct BleAttachmentBlob: Equatable {
    public let sosId: String
    public let attachmentId: String
    public let payload: Data

    public init(sosId: String, attachmentId: String, payload: Data) {
        self.sosId = sosId
        self.attachmentId = attachmentId
        self.payload = payload
    }
}

/// Supplies the sender's own attachments for the BLE hop. Synchronous on purpose: shrinking happens ahead of time.
public protocol BleAttachmentProviding: AnyObject {
    /// Prepared copies this peer has not received yet (bounded retries per peer).
    func pendingBlobs(forPeer peerId: String) -> [BleAttachmentBlob]
    func markDelivered(sosId: String, attachmentId: String, peerId: String)
    func markFailed(sosId: String, attachmentId: String, peerId: String)
}

#if os(iOS)
import AVFoundation
import ImageIO
import UniformTypeIdentifiers

/// WhatsApp-style shrinking of the BLE-carried copy only (the original stays queued for the sender's own upload).
/// Platform APIs only. Never drops: images step down edge + quality, audio is trimmed to the cap.
public enum BleAttachmentShrinker {
    /// Media bytes before encryption. The JSON-base64 inner + ChaCha20 tag put ~215 KB / ~171 KB on the air.
    public static let maxImageBytes = 160 * 1024
    public static let maxAudioBytes = 128 * 1024
    private static let imageEdges = [1280, 1024, 800, 640, 480, 320]
    private static let imageQualities: [CGFloat] = [0.7, 0.5, 0.35]
    private static let audioContainerSlack = 6 * 1024

    /// Downscales (longest edge), applies orientation and re-encodes JPEG with stepped quality. No source metadata
    /// is copied into the output, so EXIF/GPS is gone.
    public static func shrinkImage(at url: URL, maxBytes: Int = maxImageBytes) -> Data? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
        let width = (props?[kCGImagePropertyPixelWidth] as? Int) ?? 0
        let height = (props?[kCGImagePropertyPixelHeight] as? Int) ?? 0
        let longest = max(width, height)
        for edge in imageEdges {
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceShouldCacheImmediately: true,
                kCGImageSourceThumbnailMaxPixelSize: longest > 0 ? min(edge, longest) : edge,
            ]
            guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { continue }
            for quality in imageQualities {
                let out = NSMutableData()
                guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { continue }
                CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
                if CGImageDestinationFinalize(dest), out.length <= maxBytes { return out as Data }
            }
        }
        return nil
    }

    /// Audio: the recorder writes mono 16 kHz ~24 kbps AAC, so normally the file is returned as-is. Anything larger
    /// is trimmed (AVAssetExportSession time range) to fit instead of being dropped.
    public static func shrinkAudio(at url: URL, workDir: URL, maxBytes: Int = maxAudioBytes) async -> Data? {
        guard let size = (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize, size > 0 else { return nil }
        if size <= maxBytes { return try? Data(contentsOf: url) }
        let asset = AVURLAsset(url: url)
        guard let duration = try? await asset.load(.duration), duration.seconds > 1 else { return nil }
        try? FileManager.default.createDirectory(at: workDir, withIntermediateDirectories: true)
        var seconds = duration.seconds * Double(maxBytes - audioContainerSlack) / Double(size) * 0.92
        for _ in 0 ..< 4 {
            guard seconds >= 1 else { return nil }
            let out = workDir.appendingPathComponent("trim_\(UUID().uuidString).m4a")
            defer { try? FileManager.default.removeItem(at: out) }
            guard await export(asset: asset, to: out, seconds: seconds),
                  let data = try? Data(contentsOf: out) else { return nil }
            if data.count <= maxBytes { return data }
            seconds *= 0.8
        }
        return nil
    }

    private static func export(asset: AVAsset, to url: URL, seconds: Double) async -> Bool {
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else { return false }
        session.outputURL = url
        session.outputFileType = .m4a
        session.timeRange = CMTimeRange(start: .zero, duration: CMTime(seconds: seconds, preferredTimescale: 600))
        return await withCheckedContinuation { continuation in
            session.exportAsynchronously { continuation.resume(returning: session.status == .completed) }
        }
    }
}

/// Sender side of the BLE attachment hop: shrinks the queued photo/voice copies ahead of time (`prepareAll`), encrypts
/// them with the existing server-key scheme (AAD binds purpose, sosId, attachmentId, kind) and hands them out per peer.
public final class BleAttachmentSender: BleAttachmentProviding, @unchecked Sendable {
    private static let maxAttemptsPerPeer = 3
    private let queue: AttachmentQueue
    private let config: CryptoConfig
    private let workDir: URL
    private let activeSosIds: () -> Set<String>
    private let lock = NSLock()
    private var prepared: [String: BleAttachmentBlob] = [:]
    private var delivered = Set<String>()
    private var attempts: [String: Int] = [:]

    public init(queue: AttachmentQueue, config: CryptoConfig, workDir: URL, activeSosIds: @escaping () -> Set<String>) {
        self.queue = queue
        self.config = config
        self.workDir = workDir
        self.activeSosIds = activeSosIds
    }

    /// Shrinks + encrypts every still-queued attachment of an active own SOS that has no copy yet.
    public func prepareAll() async {
        let active = activeSosIds()
        var perSos: [String: Int] = [:]
        for item in queue.listPending() where active.contains(item.sosMessageId) && (item.kind == "image" || item.kind == "audio") {
            perSos[item.sosMessageId, default: 0] += 1
            guard perSos[item.sosMessageId]! <= BleAttachmentWire.maxAttachmentsPerSos, !isPrepared(item.id) else { continue }
            guard let blob = await build(item) else { continue }
            store(item.id, blob)
        }
    }

    public func pendingBlobs(forPeer peerId: String) -> [BleAttachmentBlob] {
        lock.lock(); defer { lock.unlock() }
        let active = activeSosIds()
        let stillQueued = Set(queue.listPending().map(\.id))
        return prepared.filter { id, blob in
            let key = Self.key(blob.sosId, blob.attachmentId, peerId)
            return stillQueued.contains(id) && active.contains(blob.sosId) && !delivered.contains(key)
                && (attempts[key] ?? 0) < Self.maxAttemptsPerPeer
        }.map(\.value).sorted { $0.attachmentId < $1.attachmentId }
    }

    public func markDelivered(sosId: String, attachmentId: String, peerId: String) {
        lock.lock(); defer { lock.unlock() }
        delivered.insert(Self.key(sosId, attachmentId, peerId))
    }

    public func markFailed(sosId: String, attachmentId: String, peerId: String) {
        lock.lock(); defer { lock.unlock() }
        attempts[Self.key(sosId, attachmentId, peerId), default: 0] += 1
    }

    private static func key(_ sosId: String, _ attachmentId: String, _ peerId: String) -> String { "\(sosId)|\(attachmentId)|\(peerId)" }

    private func isPrepared(_ id: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return prepared[id] != nil
    }

    private func store(_ id: String, _ blob: BleAttachmentBlob) {
        lock.lock(); defer { lock.unlock() }
        prepared[id] = blob
    }

    private func build(_ item: QueuedAttachment) async -> BleAttachmentBlob? {
        let url = URL(fileURLWithPath: item.dataPath)
        guard let original = try? Data(contentsOf: url) else { return nil }
        let shrunk: Data?
        if item.kind == "image" {
            shrunk = BleAttachmentShrinker.shrinkImage(at: url)
        } else {
            shrunk = await BleAttachmentShrinker.shrinkAudio(at: url, workDir: workDir)
        }
        guard let media = shrunk else { return nil }
        let mime = item.kind == "image" ? "image/jpeg" : "audio/mp4"
        let inner: [String: Any] = ["mime": mime, "sha256": MeshV2.sha256Hex(original), "data": media.base64EncodedString()]
        guard let innerData = try? JSONSerialization.data(withJSONObject: inner) else { return nil }
        let envelope: [String: Any] = ["purpose": "attachment", "sosId": item.sosMessageId, "attachmentId": item.id, "kind": item.kind]
        guard let encrypted = try? SOSMeshCrypto.encryptPayload(innerData, envelope: envelope, config: config),
              let ciphertext = Data(base64Encoded: encrypted.ciphertext),
              let payload = BleAttachmentWire.encode(
                  sosId: item.sosMessageId, attachmentId: item.id, kind: item.kind, nonce: encrypted.nonce,
                  ephemeralPublicKey: encrypted.ephemeralPublicKey, keyId: encrypted.keyId, ciphertext: ciphertext
              ) else { return nil }
        return BleAttachmentBlob(sosId: item.sosMessageId, attachmentId: item.id, payload: payload)
    }
}
#endif
