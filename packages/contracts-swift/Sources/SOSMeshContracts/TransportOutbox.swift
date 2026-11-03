import Foundation

public struct StateTransitionEdge: Codable {
    public let from: String
    public let to: String
}

public struct StateTransitionsFixture: Codable {
    public let version: Int
    public let progressOrder: [String]
    public let terminalStates: [String]
    public let validTransitions: [StateTransitionEdge]
    public let uxTimelineKeys: [String: String]
    public let defaultRetentionMs: Int64
}

public enum TransportStateError: Error {
    case invalidTransition(from: String, to: String)
    case fixtureNotFound
    case ioFailure
}

public final class StateTransitionLoader {
    public static func load(sourceRoot: String) throws -> StateTransitionsFixture {
        let path = "\(sourceRoot)/packages/fixtures/transport/state-transitions.json"
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(StateTransitionsFixture.self, from: data)
    }
}

public final class DeliveryStateMachine {
    private let allowed: Set<String>
    private let terminal: Set<String>

    public init(fixture: StateTransitionsFixture) {
        allowed = Set(fixture.validTransitions.map { "\($0.from)->\($0.to)" })
        terminal = Set(fixture.terminalStates)
    }

    public convenience init(sourceRoot: String) throws {
        try self.init(fixture: StateTransitionLoader.load(sourceRoot: sourceRoot))
    }

    public func canTransition(from: String, to: String) -> Bool {
        allowed.contains("\(from)->\(to)")
    }

    @discardableResult
    public func transition(from: String, to: String) throws -> String {
        if !canTransition(from: from, to: to) {
            throw TransportStateError.invalidTransition(from: from, to: to)
        }
        return to
    }

    public func isTerminal(_ state: String) -> Bool {
        terminal.contains(state)
    }
}

public struct OutboxEntryMeta: Equatable, Codable {
    public let sosId: String
    public let digest: String
    public let origin: String
    public let encryptedBlobBase64: String
    public let state: String
    public let retryAtMs: Int64
    public let expiresAtMs: Int64
    public let lastError: String?
    public let createdAtMs: Int64
    public let updatedAtMs: Int64

    public init(
        sosId: String,
        digest: String,
        origin: String,
        encryptedBlobBase64: String,
        state: String,
        retryAtMs: Int64,
        expiresAtMs: Int64,
        lastError: String?,
        createdAtMs: Int64,
        updatedAtMs: Int64
    ) {
        self.sosId = sosId
        self.digest = digest
        self.origin = origin
        self.encryptedBlobBase64 = encryptedBlobBase64
        self.state = state
        self.retryAtMs = retryAtMs
        self.expiresAtMs = expiresAtMs
        self.lastError = lastError
        self.createdAtMs = createdAtMs
        self.updatedAtMs = updatedAtMs
    }
}

public struct EnqueueInput {
    public let sosId: String
    public let digest: String
    public let origin: String
    public let encryptedBlobBase64: String
    public let retentionMs: Int64?

    public init(
        sosId: String,
        digest: String,
        origin: String,
        encryptedBlobBase64: String,
        retentionMs: Int64? = nil
    ) {
        self.sosId = sosId
        self.digest = digest
        self.origin = origin
        self.encryptedBlobBase64 = encryptedBlobBase64
        self.retentionMs = retentionMs
    }
}

public enum OutboxRetryPolicy {
    public static let defaultBackoffMs: Int64 = 60_000
    public static let maxBackoffMs: Int64 = 3_600_000

    public static func nextRetryAt(nowMs: Int64, attempt: Int) -> Int64 {
        let exponent = max(0, attempt - 1)
        let multiplier = Int64(pow(2.0, Double(exponent)))
        let backoff = min(maxBackoffMs, defaultBackoffMs * multiplier)
        return nowMs + backoff
    }
}

private struct OutboxStoreFile: Codable {
    var entries: [OutboxEntryMeta]
}

/// Disk-backed outbox using atomic file writes (Linux CI). iOS on-device behavior NOT_TESTED.
public final class DiskOutboxQueue {
    private let storeURL: URL
    private let defaultRetentionMs: Int64
    private let lock = NSLock()

    public init(storePath: String, defaultRetentionMs: Int64) {
        self.storeURL = URL(fileURLWithPath: storePath)
        self.defaultRetentionMs = defaultRetentionMs
    }

    public func enqueue(input: EnqueueInput, nowMs: Int64) throws -> OutboxEntryMeta {
        lock.lock()
        defer { lock.unlock() }
        var store = try readStoreUnlocked()
        if let existing = store.entries.first(where: { $0.sosId == input.sosId && $0.digest == input.digest }) {
            return existing
        }
        let retention = input.retentionMs ?? defaultRetentionMs
        let entry = OutboxEntryMeta(
            sosId: input.sosId,
            digest: input.digest,
            origin: input.origin,
            encryptedBlobBase64: input.encryptedBlobBase64,
            state: "LOCAL_SAVED",
            retryAtMs: nowMs,
            expiresAtMs: nowMs + retention,
            lastError: nil,
            createdAtMs: nowMs,
            updatedAtMs: nowMs
        )
        store.entries.append(entry)
        try writeStoreUnlocked(store)
        return entry
    }

    public func listAll() throws -> [OutboxEntryMeta] {
        lock.lock()
        defer { lock.unlock() }
        return try readStoreUnlocked().entries.sorted { $0.createdAtMs < $1.createdAtMs }
    }

    public func countDueForSend(nowMs: Int64, paused: Bool) throws -> Int {
        if paused { return 0 }
        lock.lock()
        defer { lock.unlock() }
        let entries = try readStoreUnlocked().entries
        return entries.filter {
            $0.retryAtMs <= nowMs && $0.state != "FAILED" && $0.state != "EXPIRED"
        }.count
    }

    public func purgeExpired(nowMs: Int64) throws -> Int {
        lock.lock()
        defer { lock.unlock() }
        var store = try readStoreUnlocked()
        let before = store.entries.count
        store.entries.removeAll { $0.expiresAtMs <= nowMs }
        try writeStoreUnlocked(store)
        return before - store.entries.count
    }

    public func getByKey(sosId: String, digest: String) throws -> OutboxEntryMeta? {
        lock.lock()
        defer { lock.unlock() }
        return try readStoreUnlocked().entries.first { $0.sosId == sosId && $0.digest == digest }
    }

    @discardableResult
    public func updateState(
        sosId: String,
        digest: String,
        state: String,
        nowMs: Int64,
        lastError: String? = nil
    ) throws -> OutboxEntryMeta? {
        lock.lock()
        defer { lock.unlock() }
        var store = try readStoreUnlocked()
        guard let idx = store.entries.firstIndex(where: { $0.sosId == sosId && $0.digest == digest }) else {
            return nil
        }
        let old = store.entries[idx]
        let updated = OutboxEntryMeta(
            sosId: old.sosId,
            digest: old.digest,
            origin: old.origin,
            encryptedBlobBase64: old.encryptedBlobBase64,
            state: state,
            retryAtMs: old.retryAtMs,
            expiresAtMs: old.expiresAtMs,
            lastError: lastError,
            createdAtMs: old.createdAtMs,
            updatedAtMs: nowMs
        )
        store.entries[idx] = updated
        try writeStoreUnlocked(store)
        return updated
    }

    public func setRetryAt(sosId: String, digest: String, retryAtMs: Int64, lastError: String?) throws {
        lock.lock()
        defer { lock.unlock() }
        var store = try readStoreUnlocked()
        guard let idx = store.entries.firstIndex(where: { $0.sosId == sosId && $0.digest == digest }) else {
            return
        }
        let old = store.entries[idx]
        store.entries[idx] = OutboxEntryMeta(
            sosId: old.sosId,
            digest: old.digest,
            origin: old.origin,
            encryptedBlobBase64: old.encryptedBlobBase64,
            state: old.state,
            retryAtMs: retryAtMs,
            expiresAtMs: old.expiresAtMs,
            lastError: lastError,
            createdAtMs: old.createdAtMs,
            updatedAtMs: old.updatedAtMs
        )
        try writeStoreUnlocked(store)
    }

    private func readStoreUnlocked() throws -> OutboxStoreFile {
        let fm = FileManager.default
        if !fm.fileExists(atPath: storeURL.path) {
            return OutboxStoreFile(entries: [])
        }
        let data = try Data(contentsOf: storeURL)
        return try JSONDecoder().decode(OutboxStoreFile.self, from: data)
    }

    private func writeStoreUnlocked(_ store: OutboxStoreFile) throws {
        let data = try JSONEncoder().encode(store)
        let tmp = storeURL.appendingPathExtension("tmp")
        try data.write(to: tmp, options: .atomic)
        let fm = FileManager.default
        if fm.fileExists(atPath: storeURL.path) {
            try fm.removeItem(at: storeURL)
        }
        try fm.moveItem(at: tmp, to: storeURL)
    }
}
