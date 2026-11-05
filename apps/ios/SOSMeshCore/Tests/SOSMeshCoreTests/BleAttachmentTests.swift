import CryptoKit
import XCTest
@testable import SOSMeshCore
import SOSMeshContracts

/// mesh-v2 §2.5: opaque attachment copies over BLE (wire, relay store, central-session ordering).
final class BleAttachmentTests: XCTestCase {
    private let now: Int64 = 1_793_000_000_000
    private let ciphertext = Data((0 ..< 2048).map { UInt8(truncatingIfNeeded: $0 * 31) })

    private func sample(kind: String = "image", id: String = "abc123") -> Data {
        BleAttachmentWire.encode(sosId: "sos-1", attachmentId: id, kind: kind, nonce: "bm9uY2U=", ephemeralPublicKey: "ZXBo", keyId: "key-1", ciphertext: ciphertext)!
    }

    func testWireRoundTripKeepsBinaryCiphertext() {
        let parsed = BleAttachmentWire.decode(sample())
        XCTAssertEqual(parsed?.sosId, "sos-1")
        XCTAssertEqual(parsed?.attachmentId, "abc123")
        XCTAssertEqual(parsed?.kind, "image")
        XCTAssertEqual(parsed?.ciphertext, ciphertext)
        let withNewlines = Data([10, 10, 1, 2, 10])
        let payload = BleAttachmentWire.encode(sosId: "s", attachmentId: "a1", kind: "audio", nonce: "n", ephemeralPublicKey: "e", keyId: "k", ciphertext: withNewlines)!
        XCTAssertEqual(BleAttachmentWire.decode(payload)?.ciphertext, withNewlines)
    }

    func testOtherPayloadsAreNotAttachmentsAndBadHeadersAreRejected() {
        XCTAssertFalse(BleAttachmentWire.isAttachment(Data("{\"kind\":\"TOMBSTONES\"}".utf8)))
        XCTAssertTrue(BleAttachmentWire.isAttachment(sample()))
        XCTAssertNil(BleAttachmentWire.decode(sample(kind: "video")))
        XCTAssertNil(BleAttachmentWire.decode(sample(id: "../x")))
        let huge = Data(count: BleAttachmentWire.maxCiphertextBytes + 1)
        let payload = BleAttachmentWire.encode(sosId: "s", attachmentId: "a1", kind: "image", nonce: "n", ephemeralPublicKey: "e", keyId: "k", ciphertext: huge)!
        XCTAssertNil(BleAttachmentWire.decode(payload))
    }

    func testRelayStoreBoundsCopiesAndKeepsToken() throws {
        let dir = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("relay-att-\(UUID().uuidString)")
        let store = RelayAttachmentStore(directory: dir)
        for i in 0 ..< BleAttachmentWire.maxAttachmentsPerSos {
            XCTAssertNotNil(store.save(sample(id: "att\(i)")))
        }
        XCTAssertNil(store.save(sample(id: "overflow")), "at most 4 copies per SOS")
        XCTAssertNotNil(store.save(sample(id: "att0")), "same copy again is idempotent")
        XCTAssertEqual(store.pendingFiles(sosId: "sos-1").count, 4)
        XCTAssertNil(store.uploadToken(sosId: "sos-1"))
        store.setUploadToken("sos-1:abcd", sosId: "sos-1")
        XCTAssertEqual(store.uploadToken(sosId: "sos-1"), "sos-1:abcd")
        XCTAssertEqual(store.sosIdsReadyForUpload(), ["sos-1"])
        store.pendingFiles(sosId: "sos-1").forEach(store.delete)
        XCTAssertTrue(store.sosIdsReadyForUpload().isEmpty)
    }

    private final class FakeProvider: BleAttachmentProviding {
        var blobs: [BleAttachmentBlob]
        var delivered: [String] = []
        var failed: [String] = []
        init(_ blobs: [BleAttachmentBlob]) { self.blobs = blobs }
        func pendingBlobs(forPeer peerId: String) -> [BleAttachmentBlob] { blobs.filter { !delivered.contains($0.attachmentId) } }
        func markDelivered(sosId: String, attachmentId: String, peerId: String) { delivered.append(attachmentId) }
        func markFailed(sosId: String, attachmentId: String, peerId: String) { failed.append(attachmentId) }
    }

    private func makeNode() throws -> (MeshV2Node, SosOutboxService) {
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0 ..< 5 { root.deleteLastPathComponent() }
        let sourceRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] ?? root.path
        let outbox = try SosOutboxService(storePath: NSTemporaryDirectory() + "att-\(UUID().uuidString).json", sourceRoot: sourceRoot)
        let key = Curve25519.Signing.PrivateKey()
        let spki = (Data([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]) + key.publicKey.rawRepresentation).base64EncodedString()
        return (MeshV2Node(outbox: outbox, relayIdHex: String(repeating: "a", count: 64), receiptKeySpkiBase64: spki, directory: nil, nowMs: now), outbox)
    }

    func testCentralSessionSendsAttachmentsAfterTheSosAndMarksThem() throws {
        let (sender, outbox) = try makeNode()
        let id = "77777777-7777-4777-8777-777777777777"
        let l2 = Data("{\"encryptedPayload\":\"OPAQUE\",\"envelope\":{\"ackLevel\":\"DEVICE_STORED\",\"location\":null,\"locationStatus\":\"UNKNOWN\",\"priority\":1,\"relayCount\":0,\"timestamp\":\"\(MeshV2.iso8601(ms: now))\"},\"id\":\"\(id)\",\"version\":1}".utf8)
        _ = try outbox.enqueueLocalSos(input: EnqueueInput(sosId: id, digest: BleProtocol.calculateSHA256(l2).base64EncodedString(), origin: "ios", encryptedBlobBase64: l2.base64EncodedString()), nowMs: now)
        let blob = BleAttachmentBlob(sosId: id, attachmentId: "att1", payload: sample())
        let provider = FakeProvider([blob])
        let info = MeshInfo(hops: 1, flags: 3, carryFillPercent: 0, secondsSinceConfirmed: 1, selfKey: 1, parentKey: 0)
        let session = MeshV2CentralSession(node: sender, peerId: "p", peerInfo: info, attachments: provider)
        _ = session.start(nowMs: now)
        let first = session.handleNotification(MeshV2Frame.offerReply([.want]).encode()!, nowMs: now)
        guard case .transfer(let sosId, _, _) = first.first else { return XCTFail("SOS first") }
        XCTAssertEqual(sosId, id)
        let second = session.transferFinished(success: true, nowMs: now)
        XCTAssertEqual(second, [.transfer(sosId: "att-att1", digest: "", payload: blob.payload)])
        XCTAssertEqual(session.transferFinished(success: true, nowMs: now), [.finished])
        XCTAssertEqual(provider.delivered, ["att1"])
    }

    func testCentralSessionSkipsAttachmentsOfRefusedSosAndMarksFailures() throws {
        let (sender, outbox) = try makeNode()
        let id = "88888888-8888-4888-8888-888888888888"
        let l2 = Data("{\"encryptedPayload\":\"OPAQUE\",\"envelope\":{\"ackLevel\":\"DEVICE_STORED\",\"location\":null,\"locationStatus\":\"UNKNOWN\",\"priority\":1,\"relayCount\":0,\"timestamp\":\"\(MeshV2.iso8601(ms: now))\"},\"id\":\"\(id)\",\"version\":1}".utf8)
        _ = try outbox.enqueueLocalSos(input: EnqueueInput(sosId: id, digest: BleProtocol.calculateSHA256(l2).base64EncodedString(), origin: "ios", encryptedBlobBase64: l2.base64EncodedString()), nowMs: now)
        let provider = FakeProvider([BleAttachmentBlob(sosId: id, attachmentId: "att2", payload: sample())])
        let info = MeshInfo(hops: 1, flags: 3, carryFillPercent: 0, secondsSinceConfirmed: 1, selfKey: 1, parentKey: 0)
        let refused = MeshV2CentralSession(node: sender, peerId: "p1", peerInfo: info, attachments: provider)
        _ = refused.start(nowMs: now)
        XCTAssertEqual(refused.handleNotification(MeshV2Frame.offerReply([.refused]).encode()!, nowMs: now), [.finished])
        let failing = MeshV2CentralSession(node: sender, peerId: "p2", peerInfo: info, attachments: provider)
        _ = failing.start(nowMs: now)
        _ = failing.handleNotification(MeshV2Frame.offerReply([.have]).encode()!, nowMs: now)
        XCTAssertEqual(failing.transferFinished(success: false, nowMs: now), [.finished])
        XCTAssertEqual(provider.failed, ["att2"])
    }
}
