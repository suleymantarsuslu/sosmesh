import Foundation
import SOSMeshContracts
import SOSMeshCore

/// Bridges iPhone outbox to watch-originated SOS ingress (testable core in SOSMeshCore).
final class PhoneWatchOutboxAdapter: WatchPhoneOutboxPort, @unchecked Sendable {
    private let queue: DiskOutboxQueue

    init(sourceRoot: String, storePath: String) throws {
        let fixture = try StateTransitionLoader.load(sourceRoot: sourceRoot)
        queue = DiskOutboxQueue(storePath: storePath, defaultRetentionMs: fixture.defaultRetentionMs)
    }

    func listAll() throws -> [OutboxEntryMeta] {
        try queue.listAll()
    }

    func enqueue(input: EnqueueInput, nowMs: Int64) throws -> OutboxEntryMeta {
        try queue.enqueue(input: input, nowMs: nowMs)
    }
}

enum PhoneWatchCompanionBootstrap {
    static func resolveSourceRoot() -> String {
        if let env = ProcessInfo.processInfo.environment["SOURCE_ROOT"], !env.isEmpty {
            return env
        }
        var url = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        for _ in 0 ..< 8 {
            let fixture = url.appendingPathComponent("packages/fixtures/transport/state-transitions.json")
            if FileManager.default.fileExists(atPath: fixture.path) {
                return url.path
            }
            url.deleteLastPathComponent()
        }
        return URL(fileURLWithPath: #filePath).deletingLastPathComponent().path
    }

    static func makeSessionManager(sourceRoot: String) throws -> PhoneWatchSessionManager {
        let storePath = NSTemporaryDirectory().appending("sosmesh-watch-ingress-outbox.json")
        let outbox = try PhoneWatchOutboxAdapter(sourceRoot: sourceRoot, storePath: storePath)
        let ingress = PhoneWatchSosIngress(outbox: outbox)
        return PhoneWatchSessionManager(ingress: ingress)
    }
}
