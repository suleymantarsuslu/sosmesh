import Foundation
import SQLite3

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

public struct OutboxEntryMeta: Equatable {
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

/// Disk-backed SQLite outbox (Linux CI). iOS on-device behavior NOT_TESTED.
public final class SqliteOutboxQueue {
    private var db: OpaquePointer?
    private let defaultRetentionMs: Int64

    public init(dbPath: String, defaultRetentionMs: Int64) throws {
        self.defaultRetentionMs = defaultRetentionMs
        if sqlite3_open(dbPath, &db) != SQLITE_OK {
            throw TransportStateError.fixtureNotFound
        }
        try exec(
            """
            CREATE TABLE IF NOT EXISTS outbox (
              sos_id TEXT NOT NULL,
              digest TEXT NOT NULL,
              origin TEXT NOT NULL,
              encrypted_blob TEXT NOT NULL,
              state TEXT NOT NULL,
              retry_at INTEGER NOT NULL,
              expires_at INTEGER NOT NULL,
              last_error TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              PRIMARY KEY (sos_id, digest)
            );
            """
        )
    }

    deinit {
        if db != nil {
            sqlite3_close(db)
        }
    }

    public func enqueue(input: EnqueueInput, nowMs: Int64) throws -> OutboxEntryMeta {
        if let existing = try getByKey(sosId: input.sosId, digest: input.digest) {
            return existing
        }
        let retention = input.retentionMs ?? defaultRetentionMs
        let expiresAt = nowMs + retention
        try exec(
            """
            INSERT INTO outbox (
              sos_id, digest, origin, encrypted_blob, state,
              retry_at, expires_at, last_error, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'LOCAL_SAVED', ?, ?, NULL, ?, ?);
            """,
            bind: { stmt in
                sqlite3_bind_text(stmt, 1, input.sosId, -1, nil)
                sqlite3_bind_text(stmt, 2, input.digest, -1, nil)
                sqlite3_bind_text(stmt, 3, input.origin, -1, nil)
                sqlite3_bind_text(stmt, 4, input.encryptedBlobBase64, -1, nil)
                sqlite3_bind_int64(stmt, 5, nowMs)
                sqlite3_bind_int64(stmt, 6, expiresAt)
                sqlite3_bind_int64(stmt, 7, nowMs)
                sqlite3_bind_int64(stmt, 8, nowMs)
            }
        )
        return try getByKey(sosId: input.sosId, digest: input.digest)!
    }

    public func getByKey(sosId: String, digest: String) throws -> OutboxEntryMeta? {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(
            db,
            "SELECT * FROM outbox WHERE sos_id = ? AND digest = ?;",
            -1,
            &stmt,
            nil
        ) == SQLITE_OK else { return nil }
        sqlite3_bind_text(stmt, 1, sosId, -1, nil)
        sqlite3_bind_text(stmt, 2, digest, -1, nil)
        guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
        return readRow(stmt: stmt!)
    }

    public func listAll() throws -> [OutboxEntryMeta] {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, "SELECT * FROM outbox ORDER BY created_at ASC;", -1, &stmt, nil)
            == SQLITE_OK
        else { return [] }
        var rows: [OutboxEntryMeta] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            rows.append(readRow(stmt: stmt!)!)
        }
        return rows
    }

    public func countDueForSend(nowMs: Int64, paused: Bool) throws -> Int {
        if paused { return 0 }
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(
            db,
            """
            SELECT COUNT(*) FROM outbox
            WHERE retry_at <= ? AND state NOT IN ('FAILED', 'EXPIRED');
            """,
            -1,
            &stmt,
            nil
        ) == SQLITE_OK else { return 0 }
        sqlite3_bind_int64(stmt, 1, nowMs)
        guard sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
        return Int(sqlite3_column_int(stmt, 0))
    }

    public func purgeExpired(nowMs: Int64) throws -> Int {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(
            db,
            "DELETE FROM outbox WHERE expires_at <= ?;",
            -1,
            &stmt,
            nil
        ) == SQLITE_OK else { return 0 }
        sqlite3_bind_int64(stmt, 1, nowMs)
        guard sqlite3_step(stmt) == SQLITE_DONE else { return 0 }
        return Int(sqlite3_changes(db))
    }

    private func exec(_ sql: String, bind: ((OpaquePointer?) -> Void)? = nil) throws {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw TransportStateError.fixtureNotFound
        }
        bind?(stmt)
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw TransportStateError.fixtureNotFound
        }
    }

    private func readRow(stmt: OpaquePointer) -> OutboxEntryMeta? {
        func col(_ index: Int32) -> String {
            guard let c = sqlite3_column_text(stmt, index) else { return "" }
            return String(cString: c)
        }
        let lastErrIdx = sqlite3_column_type(stmt, 7) == SQLITE_NULL ? nil : col(7)
        return OutboxEntryMeta(
            sosId: col(0),
            digest: col(1),
            origin: col(2),
            encryptedBlobBase64: col(3),
            state: col(4),
            retryAtMs: sqlite3_column_int64(stmt, 5),
            expiresAtMs: sqlite3_column_int64(stmt, 6),
            lastError: lastErrIdx,
            createdAtMs: sqlite3_column_int64(stmt, 8),
            updatedAtMs: sqlite3_column_int64(stmt, 9)
        )
    }
}
