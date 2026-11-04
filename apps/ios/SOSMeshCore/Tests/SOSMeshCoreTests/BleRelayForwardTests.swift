import XCTest
@testable import SOSMeshCore
import SOSMeshContracts

/// Offline sender -> BLE -> relay phone -> server, with fakes for radio and network.
final class BleRelayForwardTests: XCTestCase {
    // MARK: Fixtures

    private func sourceRoot() -> String {
        if let envRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] {
            return envRoot
        }
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0 ..< 5 { url.deleteLastPathComponent() }
        return url.path
    }

    private func makeOutbox(_ name: String) throws -> (SosOutboxService, URL) {
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("\(name)-\(UUID().uuidString).json")
        return (try SosOutboxService(storePath: tmp.path, sourceRoot: sourceRoot()), tmp)
    }

    /// Opaque wire envelope shaped like the real SosMessage JSON (the relay never opens `encryptedPayload`).
    private func envelope(id: String, secret: String = "CIPHERTEXT_BLOB") -> Data {
        let json = "{\"encryptedPayload\":\"\(secret)\",\"envelope\":{\"ackLevel\":\"DEVICE_STORED\",\"relayCount\":0},\"id\":\"\(id)\",\"version\":1}"
        return Data(json.utf8)
    }

    private final class FakeUploader: RelayIngestUploading {
        var results: [IngestUploadResult] = []
        private(set) var uploaded: [(sosId: String, blob: String)] = []

        func upload(
            sosId: String,
            digest: String,
            encryptedBlobBase64: String,
            sosMessageJson: [String: Any]
        ) async -> IngestUploadResult {
            uploaded.append((sosId, encryptedBlobBase64))
            if results.isEmpty { return .noNetwork }
            return results.removeFirst()
        }
    }

    private func receipt(_ id: String) -> ServerAcceptedReceipt {
        ServerAcceptedReceipt(
            ackType: "SERVER_ACCEPTED",
            messageId: id,
            packetHash: "hash",
            timestamp: "2026-01-01T00:00:00.000Z",
            signature: "sig",
            uploadToken: nil
        )
    }

    private final class QueueWriter: GattOutboundWriting {
        var deliver: ((String, Data) -> Void)?
        var queued: [(String, Data)] = []
        func writeCharacteristic(uuid: String, value: Data) { queued.append((uuid, value)) }
    }

    private struct Phone {
        let session: BleMeshSession
        let outbox: SosOutboxService
        let inbox: ReceivedSosInbox
        let diagnostics: RelayDiagnostics
        let serverOut: QueueWriter
        let clientOut: QueueWriter
        let file: URL
    }

    private func makePhone(name: String, clock: BleTransferClock) throws -> Phone {
        let (outbox, file) = try makeOutbox(name)
        let inbox = ReceivedSosInbox()
        let diagnostics = RelayDiagnostics()
        let router = BleIncomingPayloadRouter(
            inbox: inbox,
            store: RelayOutboxEnvelopeStore(outbox: outbox),
            diagnostics: diagnostics,
            nowMs: { 5_000 }
        )
        let serverOut = QueueWriter()
        let clientOut = QueueWriter()
        let session = BleMeshSession(
            serverOutbound: serverOut,
            clientOutbound: clientOut,
            outbox: outbox,
            incomingRouter: router,
            clock: clock,
            rng: SeededBleTransferRng(seed: 11),
            nowMs: { 10_000 }
        )
        return Phone(
            session: session,
            outbox: outbox,
            inbox: inbox,
            diagnostics: diagnostics,
            serverOut: serverOut,
            clientOut: clientOut,
            file: file
        )
    }

    /// Delivers queued GATT frames between the two phones until both sides are quiet.
    private func pump(sender: Phone, relay: Phone, clock: SimulatedBleTransferClock) {
        for _ in 0 ..< 400 {
            var moved = false
            while !sender.clientOut.queued.isEmpty {
                let frame = sender.clientOut.queued.removeFirst()
                relay.session.engine.deliverPeripheralWrite(uuid: frame.0, value: frame.1)
                moved = true
            }
            while !relay.serverOut.queued.isEmpty {
                let frame = relay.serverOut.queued.removeFirst()
                sender.session.engine.deliverCentralNotification(uuid: frame.0, value: frame.1)
                moved = true
            }
            if !moved {
                if sender.session.engine.senderState() == .completed { return }
                clock.advance(10)
            }
        }
    }

    private func enqueueOwn(_ phone: Phone, id: String, payload: Data) throws {
        _ = try phone.outbox.enqueueLocalSos(
            input: EnqueueInput(
                sosId: id,
                digest: BleProtocol.calculateSHA256(payload).base64EncodedString(),
                origin: "ios",
                encryptedBlobBase64: payload.base64EncodedString()
            ),
            nowMs: 1
        )
    }

    // MARK: BLE hop

    func testOfflineSosReachesRelayInboxAsOpaqueEnvelopeAndSenderOnlyShowsPeerReceived() throws {
        let clock = SimulatedBleTransferClock()
        let sender = try makePhone(name: "sender", clock: clock)
        let relay = try makePhone(name: "relay", clock: clock)
        defer {
            try? FileManager.default.removeItem(at: sender.file)
            try? FileManager.default.removeItem(at: relay.file)
        }
        sender.session.engine.setSenderMtu(515)
        let wire = envelope(id: "sos-1")
        try enqueueOwn(sender, id: "sos-1", payload: wire)

        XCTAssertTrue(sender.session.hasDueOwnOutbound())
        XCTAssertTrue(try sender.session.sendDueOutboxEntryIfReady(gattReady: true))
        pump(sender: sender, relay: relay, clock: clock)

        let ownEntry = try XCTUnwrap(try sender.outbox.listEntries().first)
        XCTAssertEqual(ownEntry.state, "PEER_RECEIVED", "peer ACK must not look like server receipt")
        XCTAssertNotEqual(ownEntry.state, "SERVER_ACCEPTED")

        let stored = try XCTUnwrap(relay.inbox.list().first)
        XCTAssertEqual(stored.sosId, "sos-1")
        XCTAssertEqual(stored.envelope, wire, "relay keeps the bytes exactly as received")
        XCTAssertFalse(stored.isForwarded)

        let relayEntry = try XCTUnwrap(try relay.outbox.listEntries().first)
        XCTAssertEqual(relayEntry.origin, SosOutboxService.relayOrigin)
        XCTAssertEqual(relayEntry.state, "LOCAL_SAVED")
        XCTAssertEqual(Data(base64Encoded: relayEntry.encryptedBlobBase64), wire)

        let diag = relay.diagnostics.snapshot()
        XCTAssertEqual(diag.lastReceivedAtMs, 5_000)
        XCTAssertEqual(diag.lastReceivedShortHash, RelayDiagnostics.shortHash("sos-1"))
        XCTAssertEqual(diag.lastReceivedShortHash?.count, 8)
    }

    func testSecondTransferWorksOnSameLink() throws {
        let clock = SimulatedBleTransferClock()
        let sender = try makePhone(name: "sender2", clock: clock)
        let relay = try makePhone(name: "relay2", clock: clock)
        defer {
            try? FileManager.default.removeItem(at: sender.file)
            try? FileManager.default.removeItem(at: relay.file)
        }
        for id in ["sos-a", "sos-b"] {
            try enqueueOwn(sender, id: id, payload: envelope(id: id))
            XCTAssertTrue(try sender.session.sendDueOutboxEntryIfReady(gattReady: true))
            pump(sender: sender, relay: relay, clock: clock)
        }
        XCTAssertEqual(Set(relay.inbox.list().map(\.sosId)), ["sos-a", "sos-b"])
        XCTAssertEqual(try sender.outbox.listEntries().map(\.state), ["PEER_RECEIVED", "PEER_RECEIVED"])
    }

    func testRelayCopiesAreNeverRebroadcastAsOwnSos() throws {
        let clock = SimulatedBleTransferClock()
        let relay = try makePhone(name: "relay3", clock: clock)
        defer { try? FileManager.default.removeItem(at: relay.file) }
        _ = try relay.outbox.enqueueRelayEnvelope(
            sosId: "other",
            digest: "d",
            envelope: envelope(id: "other"),
            nowMs: 1
        )
        XCTAssertFalse(relay.session.hasDueOwnOutbound())
        XCTAssertFalse(try relay.session.sendDueOutboxEntryIfReady(gattReady: true))
    }

    func testDuplicateDeliveryIsStoredOnce() throws {
        let inbox = ReceivedSosInbox()
        let (outbox, file) = try makeOutbox("dup")
        defer { try? FileManager.default.removeItem(at: file) }
        let router = BleIncomingPayloadRouter(inbox: inbox, store: RelayOutboxEnvelopeStore(outbox: outbox))
        let wire = envelope(id: "sos-dup")
        router.onCompleted(payload: wire)
        router.onCompleted(payload: wire)
        XCTAssertEqual(inbox.list().count, 1)
        XCTAssertEqual(try outbox.listEntries().count, 1)
    }

    func testShortUuidFormsAreAccepted() {
        XCTAssertEqual(
            BleMeshConstants.canonicalUuid("fff1"),
            BleMeshConstants.controlCharacteristicUUID
        )
        XCTAssertEqual(
            BleMeshConstants.canonicalUuid(BleMeshConstants.ackCharacteristicUUID.lowercased()),
            BleMeshConstants.ackCharacteristicUUID
        )
    }

    // MARK: Server forward

    func testForwardMarksServerAcceptedOnlyAfterReceipt() async throws {
        let (outbox, file) = try makeOutbox("fwd-ok")
        defer { try? FileManager.default.removeItem(at: file) }
        let inbox = ReceivedSosInbox()
        let wire = envelope(id: "sos-9")
        let digest = BleProtocol.calculateSHA256(wire).base64EncodedString()
        _ = inbox.append(sosId: "sos-9", digest: digest, envelope: wire, nowMs: 1)
        try outbox.enqueueRelayEnvelope(sosId: "sos-9", digest: digest, envelope: wire, nowMs: 1)
        let uploader = FakeUploader()
        uploader.results = [.success(receipt("sos-9"))]
        let diagnostics = RelayDiagnostics()
        let forwarder = RelayForwarder(
            outbox: outbox,
            inbox: inbox,
            uploader: uploader,
            diagnostics: diagnostics,
            nowMs: { 2_000 }
        )
        XCTAssertEqual(forwarder.pendingCount(), 1)

        let summary = await forwarder.forwardDue()

        XCTAssertEqual(summary.accepted, 1)
        XCTAssertEqual(uploader.uploaded.first?.blob, wire.base64EncodedString(), "bytes uploaded unchanged")
        XCTAssertEqual(try outbox.listEntries().first?.state, "SERVER_ACCEPTED")
        XCTAssertEqual(inbox.list().first?.forwardedAtMs, 2_000)
        XCTAssertEqual(forwarder.pendingCount(), 0)
        XCTAssertEqual(diagnostics.snapshot().forwardedCount, 1)
    }

    func testOfflineForwardStaysPendingAndRetriesLater() async throws {
        let (outbox, file) = try makeOutbox("fwd-offline")
        defer { try? FileManager.default.removeItem(at: file) }
        let inbox = ReceivedSosInbox()
        let wire = envelope(id: "sos-off")
        let digest = BleProtocol.calculateSHA256(wire).base64EncodedString()
        _ = inbox.append(sosId: "sos-off", digest: digest, envelope: wire, nowMs: 1)
        try outbox.enqueueRelayEnvelope(sosId: "sos-off", digest: digest, envelope: wire, nowMs: 1)
        let uploader = FakeUploader()
        uploader.results = [.noNetwork, .success(receipt("sos-off"))]
        var now: Int64 = 1_000
        let forwarder = RelayForwarder(outbox: outbox, inbox: inbox, uploader: uploader, nowMs: { now })

        _ = await forwarder.forwardDue()
        var entry = try XCTUnwrap(try outbox.listEntries().first)
        XCTAssertEqual(entry.state, "LOCAL_SAVED")
        XCTAssertEqual(entry.lastError, "no_network")
        XCTAssertEqual(entry.retryAtMs, 1_000 + RelayForwarder.noNetworkBackoffMs)
        XCTAssertFalse(try XCTUnwrap(inbox.list().first).isForwarded)

        now = 1_000 + 5_000
        _ = await forwarder.forwardDue()
        XCTAssertEqual(uploader.uploaded.count, 1, "not retried before the backoff elapsed")

        now = 1_000 + RelayForwarder.noNetworkBackoffMs
        let summary = await forwarder.forwardDue()
        XCTAssertEqual(summary.accepted, 1)
        entry = try XCTUnwrap(try outbox.listEntries().first)
        XCTAssertEqual(entry.state, "SERVER_ACCEPTED")
    }

    func testRejectedPacketIsParkedNotRetriedForever() async throws {
        let (outbox, file) = try makeOutbox("fwd-409")
        defer { try? FileManager.default.removeItem(at: file) }
        let inbox = ReceivedSosInbox()
        let wire = envelope(id: "sos-409")
        let digest = BleProtocol.calculateSHA256(wire).base64EncodedString()
        try outbox.enqueueRelayEnvelope(sosId: "sos-409", digest: digest, envelope: wire, nowMs: 1)
        let uploader = FakeUploader()
        uploader.results = [.httpError(409, "MESSAGE_ID_CONFLICT")]
        let forwarder = RelayForwarder(outbox: outbox, inbox: inbox, uploader: uploader, nowMs: { 1_000 })

        _ = await forwarder.forwardDue()

        let entry = try XCTUnwrap(try outbox.listEntries().first)
        XCTAssertEqual(entry.state, "LOCAL_SAVED")
        XCTAssertEqual(entry.lastError, "needs_review")
        XCTAssertEqual(entry.retryAtMs, RelayForwarder.permanentRetryAtMs)
        XCTAssertEqual(forwarder.pendingCount(), 0)
    }

    func testServerErrorsAndBadReceiptsAreRetried() async throws {
        let (outbox, file) = try makeOutbox("fwd-5xx")
        defer { try? FileManager.default.removeItem(at: file) }
        let inbox = ReceivedSosInbox()
        let wire = envelope(id: "sos-5xx")
        let digest = BleProtocol.calculateSHA256(wire).base64EncodedString()
        try outbox.enqueueRelayEnvelope(sosId: "sos-5xx", digest: digest, envelope: wire, nowMs: 1)
        let uploader = FakeUploader()
        uploader.results = [.httpError(503, "unavailable")]
        let forwarder = RelayForwarder(outbox: outbox, inbox: inbox, uploader: uploader, nowMs: { 1_000 })

        _ = await forwarder.forwardDue()

        let entry = try XCTUnwrap(try outbox.listEntries().first)
        XCTAssertEqual(entry.state, "LOCAL_SAVED")
        XCTAssertEqual(entry.retryAtMs, 1_000 + RelayForwarder.errorBackoffMs)
        XCTAssertEqual(forwarder.pendingCount(), 1)
    }

    func testRestoreInboxReloadsPersistedEnvelopes() throws {
        let (outbox, file) = try makeOutbox("restore")
        defer { try? FileManager.default.removeItem(at: file) }
        let wire = envelope(id: "sos-r")
        try outbox.enqueueRelayEnvelope(sosId: "sos-r", digest: "d", envelope: wire, nowMs: 7)
        let inbox = ReceivedSosInbox()
        let forwarder = RelayForwarder(outbox: outbox, inbox: inbox, uploader: FakeUploader())
        forwarder.restoreInbox()
        XCTAssertEqual(inbox.list().first?.envelope, wire)
        XCTAssertEqual(inbox.list().first?.isForwarded, false)
    }

    // MARK: Privacy

    func testRelayStoresNoPlaintextAndDiagnosticsStayAnonymous() throws {
        let inbox = ReceivedSosInbox()
        let diagnostics = RelayDiagnostics()
        let router = BleIncomingPayloadRouter(inbox: inbox, diagnostics: diagnostics)
        router.onCompleted(payload: envelope(id: "sos-private-id-1234"))
        let snapshot = diagnostics.snapshot()
        let text = String(describing: snapshot)
        XCTAssertFalse(text.contains("sos-private-id-1234"))
        XCTAssertFalse(text.contains("CIPHERTEXT_BLOB"))
    }
}
