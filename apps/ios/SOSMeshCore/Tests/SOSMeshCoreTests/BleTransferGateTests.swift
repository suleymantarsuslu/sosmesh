import XCTest
@testable import SOSMeshCore
import SOSMeshContracts

final class BleTransferGateTests: XCTestCase {
    func testBadCrcChunk_nackCrcMismatch_chunkNotStored() {
        let clock = SimulatedBleTransferClock()
        let rng = SeededBleTransferRng(seed: 5)
        let channel = MockBleTransferChannel(packetLoss: 0, duplicateRate: 0, rng: rng)
        let outbound = RecordingOutbound()
        let (senderT, receiverT) = linkedPair(outbound: outbound)
        let receiver = BleTransferReceiver(transport: receiverT, config: BleTransferConfig(), clock: clock)
        let sender = BleTransferSender(
            transport: senderT,
            config: BleTransferConfig(maxRetries: 2, chunkTimeoutMs: 300),
            clock: clock,
            rng: rng
        )
        sender.startTransfer(Data("CRC_TEST".utf8))
        advanceUntil(clock: clock, channel: channel) {
            sender.getState() == .waitAck || sender.getState() == .sending
        }
        var bad = Data(count: 20)
        bad[4] = 0x12
        bad[5] = 0x34
        bad[6] = 0x56
        bad[7] = 0x78
        receiverT.deliverIncoming(uuid: BleMeshConstants.dataCharacteristicUUID, value: bad)
        channel.drain()
        XCTAssertTrue(outbound.nacks.contains(where: { $0.reason == .crcMismatch }))
        XCTAssertTrue(receiver.getReceivedChunkSeqs().isEmpty)
    }

    func testDigestMismatch_receiverFails_senderNeverCompletes_noPeerReceived() throws {
        let clock = SimulatedBleTransferClock()
        let rng = SeededBleTransferRng(seed: 9)
        let outbound = RecordingOutbound()
        let (senderT, receiverT) = linkedPair(outbound: outbound) { wire in
            corruptLastChunkDigestIfPresent(wire)
        }
        let sender = BleTransferSender(
            transport: senderT,
            config: BleTransferConfig(maxRetries: 3, chunkTimeoutMs: 400),
            clock: clock,
            rng: rng
        )
        let receiver = BleTransferReceiver(
            transport: receiverT,
            config: BleTransferConfig(maxRetries: 3, chunkTimeoutMs: 400),
            clock: clock
        )
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("gate-outbox-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tmp) }
        let outbox = try SosOutboxService(storePath: tmp.path, sourceRoot: sourceRoot())
        let tracker = SosPeerDeliveryTracker(outbox: outbox)
        tracker.active = SosPeerDeliveryTracker.ActiveTransfer(sosId: "sos-gate", digest: "digest-gate")
        tracker.attachSenderListener(sender)
        var senderCompleted = false
        receiver.setListener(QuietReceiverListener())
        sender.setListener(CompletionCapture { senderCompleted = true })
        sender.startTransfer(Data(repeating: UInt8(ascii: "X"), count: 320))
        for _ in 0 ..< 2_000 {
            if receiver.getState() == .failed || senderCompleted { break }
            clock.advance(10)
        }
        XCTAssertEqual(receiver.getState(), .failed)
        XCTAssertFalse(senderCompleted)
        let entries = try outbox.listEntries()
        XCTAssertTrue(entries.isEmpty || entries.allSatisfy { $0.state != "PEER_RECEIVED" })
        XCTAssertTrue(outbound.nacks.contains(where: { $0.reason == .digestInvalid }))
    }

    func testHappyPath_sendReceiveAndPeerVerified() throws {
        let clock = SimulatedBleTransferClock()
        let rng = SeededBleTransferRng(seed: 3)
        let channel = MockBleTransferChannel(packetLoss: 0, duplicateRate: 0, rng: rng)
        let outbound = RecordingOutbound()
        let (senderT, receiverT) = linkedPair(outbound: outbound)
        let sender = BleTransferSender(
            transport: senderT,
            config: BleTransferConfig(maxRetries: 5, chunkTimeoutMs: 400),
            clock: clock,
            rng: rng
        )
        let receiver = BleTransferReceiver(
            transport: receiverT,
            config: BleTransferConfig(maxRetries: 5, chunkTimeoutMs: 400),
            clock: clock
        )
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("happy-outbox-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: tmp) }
        let outbox = try SosOutboxService(storePath: tmp.path, sourceRoot: sourceRoot())
        _ = try outbox.enqueueLocalSos(
            input: EnqueueInput(
                sosId: "s1",
                digest: "d1",
                origin: "ios",
                encryptedBlobBase64: Data("PAYLOAD".utf8).base64EncodedString()
            ),
            nowMs: 1
        )
        let tracker = SosPeerDeliveryTracker(outbox: outbox, nowMs: { 100 })
        tracker.active = SosPeerDeliveryTracker.ActiveTransfer(sosId: "s1", digest: "d1")
        tracker.attachSenderListener(sender)
        var received: Data?
        receiver.setListener(PayloadCapture { received = $0 })
        var senderDone = false
        sender.setListener(CompletionCapture { senderDone = true })
        sender.startTransfer(Data("PAYLOAD".utf8))
        for _ in 0 ..< 5_000 {
            channel.drain()
            if senderDone, received != nil { break }
            clock.advance(5)
        }
        XCTAssertTrue(senderDone)
        XCTAssertEqual(received, Data("PAYLOAD".utf8))
        let entry = try XCTUnwrap(try outbox.listEntries().first)
        XCTAssertEqual(entry.state, "PEER_RECEIVED")
    }

    func testRelayCannotDecryptOpaquePayload() {
        let inbox = ReceivedSosInbox()
        let router = BleIncomingPayloadRouter(inbox: inbox, nowMs: { 1 })
        let opaque = Data(repeating: 0xAB, count: 64)
        router.onCompleted(payload: opaque)
        XCTAssertTrue(inbox.list().isEmpty)
    }

    private func sourceRoot() -> String {
        if let envRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] {
            return envRoot
        }
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0 ..< 5 { url.deleteLastPathComponent() }
        return url.path
    }

    private func linkedPair(
        outbound: RecordingOutbound,
        mutate: ((Data) -> Data)? = nil
    ) -> (GattBleTransferTransport, GattBleTransferTransport) {
        var senderT: GattBleTransferTransport!
        var receiverT: GattBleTransferTransport!
        senderT = GattBleTransferTransport(
            outbound: BridgeWriter { uuid, value in
                let wire = mutate?(value) ?? value
                outbound.recordSend(uuid: uuid, value: wire)
                receiverT.deliverIncoming(uuid: uuid, value: wire)
            }
        )
        receiverT = GattBleTransferTransport(
            outbound: BridgeWriter { uuid, value in
                let wire = mutate?(value) ?? value
                outbound.recordSend(uuid: uuid, value: wire)
                senderT.deliverIncoming(uuid: uuid, value: wire)
            }
        )
        return (senderT, receiverT)
    }

    private func advanceUntil(clock: SimulatedBleTransferClock, channel: MockBleTransferChannel, condition: () -> Bool) {
        for _ in 0 ..< 500 {
            if condition() { return }
            channel.drain()
            clock.advance(5)
        }
    }

    private func corruptLastChunkDigestIfPresent(_ wire: Data) -> Data {
        guard wire.count > BleTransferProtocolConstants.chunkHeaderSize else { return wire }
        guard let chunk = BleChunkCodec.deserializeChunk(wire) else { return wire }
        guard BleChunkFlags.lastChunk.has(flags: chunk.header.flags), chunk.payload.count >= 32 else { return wire }
        var mutated = chunk.payload
        mutated[mutated.count - 1] ^= 0xFF
        let corrupted = BleTransferChunk(header: chunk.header, payload: mutated)
        return BleChunkCodec.serializeChunk(corrupted)
    }

    private final class BridgeWriter: GattOutboundWriting {
        let send: (String, Data) -> Void
        init(_ send: @escaping (String, Data) -> Void) { self.send = send }
        func writeCharacteristic(uuid: String, value: Data) { send(uuid, value) }
    }

    private final class RecordingOutbound {
        struct Nack { let seq: Int; let reason: BleTransferErrorCode }
        var nacks: [Nack] = []
        func recordSend(uuid: String, value: Data) {
            guard !value.isEmpty else { return }
            if value[0] == BleTransferMessageType.nack.rawValue, value.count >= 4 {
                let seq = (Int(value[1]) << 8) | Int(value[2])
                let reason = BleTransferErrorCode(rawValue: Int(value[3])) ?? .genericTimeout
                nacks.append(Nack(seq: seq, reason: reason))
            }
        }
    }

    private final class QuietReceiverListener: BleTransferReceiver.Listener {
        func onCompleted(payload: Data) {}
        func onFailed(code: BleTransferErrorCode, message: String) {}
    }

    private final class PayloadCapture: BleTransferReceiver.Listener {
        let handler: (Data) -> Void
        init(_ handler: @escaping (Data) -> Void) { self.handler = handler }
        func onCompleted(payload: Data) { handler(payload) }
        func onFailed(code: BleTransferErrorCode, message: String) {}
    }

    private final class CompletionCapture: BleTransferSender.Listener {
        let handler: () -> Void
        init(_ handler: @escaping () -> Void) { self.handler = handler }
        func onCompleted() { handler() }
        func onFailed(code: BleTransferErrorCode, message: String) {}
    }
}
