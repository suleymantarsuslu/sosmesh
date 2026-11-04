import Foundation
import SOSMeshContracts

/// Uploads one packet to `/v1/ingest` (the same contract the own-SOS upload and Android relay use).
public protocol RelayIngestUploading: AnyObject {
    func upload(
        sosId: String,
        digest: String,
        encryptedBlobBase64: String,
        sosMessageJson: [String: Any]
    ) async -> IngestUploadResult
}

extension IngestUploader: RelayIngestUploading {}

/// Backs the relay inbox with the on-disk outbox (origin `relay`) so received envelopes survive
/// an app restart until the server accepts them.
public final class RelayOutboxEnvelopeStore: ReceivedEnvelopeStoring {
    private let outbox: SosOutboxService

    public init(outbox: SosOutboxService) {
        self.outbox = outbox
    }

    public func storeReceivedEnvelope(sosId: String, digest: String, envelope: Data, nowMs: Int64) throws {
        try outbox.enqueueRelayEnvelope(sosId: sosId, digest: digest, envelope: envelope, nowMs: nowMs)
    }
}

public struct RelayForwardSummary: Equatable {
    public var attempted = 0
    public var accepted = 0
    public init() {}
}

/// Forwards received (still encrypted) envelopes to the server.
///
/// - The envelope bytes are uploaded unchanged: the relay never opens the encrypted payload and
///   does not touch `relayCount` / `ackLevel`, so the packet hash the server and the original
///   sender compute stays identical. The server de-duplicates on message id + packet hash.
/// - An entry is marked server-accepted (and the inbox row forwarded) only after the signed
///   receipt verified. A peer ACK never counts as server receipt.
public final class RelayForwarder: @unchecked Sendable {
    public static let noNetworkBackoffMs: Int64 = 30_000
    public static let errorBackoffMs: Int64 = 120_000
    /// Entries parked for manual review / permanent client errors are not retried.
    public static let permanentRetryAtMs: Int64 = 9_223_372_036_854_775

    private let outbox: SosOutboxService
    private let inbox: ReceivedSosInbox
    private let uploader: RelayIngestUploading
    private let diagnostics: RelayDiagnostics?
    private let nowMs: () -> Int64
    private let lock = NSLock()
    private var running = false

    public init(
        outbox: SosOutboxService,
        inbox: ReceivedSosInbox,
        uploader: RelayIngestUploading,
        diagnostics: RelayDiagnostics? = nil,
        nowMs: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }
    ) {
        self.outbox = outbox
        self.inbox = inbox
        self.uploader = uploader
        self.diagnostics = diagnostics
        self.nowMs = nowMs
    }

    /// Relay envelopes still waiting for server acceptance (excludes parked entries).
    public func pendingCount() -> Int {
        let entries = (try? outbox.listEntries()) ?? []
        return entries.filter {
            $0.origin == SosOutboxService.relayOrigin
                && $0.state == "LOCAL_SAVED"
                && $0.retryAtMs < RelayForwarder.permanentRetryAtMs
        }.count
    }

    /// Re-loads envelopes persisted by an earlier run into the in-memory inbox.
    public func restoreInbox() {
        let entries = (try? outbox.listEntries()) ?? []
        for entry in entries where entry.origin == SosOutboxService.relayOrigin {
            guard let envelope = Data(base64Encoded: entry.encryptedBlobBase64) else { continue }
            if inbox.append(sosId: entry.sosId, digest: entry.digest, envelope: envelope, nowMs: entry.createdAtMs),
               entry.state != "LOCAL_SAVED" {
                inbox.markForwarded(sosId: entry.sosId, digest: entry.digest, nowMs: entry.updatedAtMs)
            }
        }
    }

    @discardableResult
    public func forwardDue() async -> RelayForwardSummary {
        var summary = RelayForwardSummary()
        guard beginRun() else { return summary }
        defer { endRun() }
        let entries = (try? outbox.listEntries()) ?? []
        for entry in entries {
            let now = nowMs()
            guard entry.origin == SosOutboxService.relayOrigin,
                  entry.state == "LOCAL_SAVED",
                  entry.retryAtMs <= now else { continue }
            guard let wire = Data(base64Encoded: entry.encryptedBlobBase64),
                  let object = try? JSONSerialization.jsonObject(with: wire) as? [String: Any],
                  (object["id"] as? String) == entry.sosId else {
                park(entry, reason: "invalid_envelope")
                continue
            }
            summary.attempted += 1
            let result = await uploader.upload(
                sosId: entry.sosId,
                digest: entry.digest,
                encryptedBlobBase64: entry.encryptedBlobBase64,
                sosMessageJson: object
            )
            switch result {
            case .success:
                let acceptedAt = nowMs()
                if (try? outbox.markServerAccepted(
                    sosId: entry.sosId,
                    digest: entry.digest,
                    fromState: entry.state,
                    nowMs: acceptedAt
                )) != nil {
                    inbox.markForwarded(sosId: entry.sosId, digest: entry.digest, nowMs: acceptedAt)
                    diagnostics?.recordForwarded()
                    summary.accepted += 1
                }
            case .noNetwork:
                retry(entry, after: RelayForwarder.noNetworkBackoffMs, reason: "no_network")
                return summary
            case .invalidReceipt:
                retry(entry, after: RelayForwarder.errorBackoffMs, reason: "invalid_receipt")
                return summary
            case .httpError(let code, _):
                if code == 409 {
                    park(entry, reason: "needs_review")
                } else if (400 ..< 500).contains(code) && code != 429 {
                    park(entry, reason: "http_\(code)")
                } else {
                    retry(entry, after: RelayForwarder.errorBackoffMs, reason: "http_\(code)")
                    return summary
                }
            case .error:
                retry(entry, after: RelayForwarder.errorBackoffMs, reason: "upload_error")
                return summary
            }
        }
        return summary
    }

    private func retry(_ entry: OutboxEntryMeta, after delayMs: Int64, reason: String) {
        try? outbox.setRetryAt(
            sosId: entry.sosId,
            digest: entry.digest,
            retryAtMs: nowMs() + delayMs,
            lastError: reason
        )
        diagnostics?.recordError(code: reason)
    }

    private func park(_ entry: OutboxEntryMeta, reason: String) {
        try? outbox.setRetryAt(
            sosId: entry.sosId,
            digest: entry.digest,
            retryAtMs: RelayForwarder.permanentRetryAtMs,
            lastError: reason
        )
        diagnostics?.recordError(code: reason)
    }

    private func beginRun() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        if running { return false }
        running = true
        return true
    }

    private func endRun() {
        lock.lock()
        running = false
        lock.unlock()
    }
}
