import CryptoKit
import XCTest
@testable import SOSMeshCore
import SOSMeshContracts

/// Mesh v2 (docs/protocol/mesh-v2.md): frames, OFFER dedupe, `h`, tombstones, ordering, limits.
final class MeshV2Tests: XCTestCase {
    private let now: Int64 = 1_793_000_000_000

    // MARK: Fixtures

    private func sourceRoot() -> String {
        if let envRoot = ProcessInfo.processInfo.environment["SOURCE_ROOT"] { return envRoot }
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0 ..< 5 { url.deleteLastPathComponent() }
        return url.path
    }

    private func makeOutbox() throws -> SosOutboxService {
        let path = NSTemporaryDirectory() + "meshv2-\(UUID().uuidString).json"
        return try SosOutboxService(storePath: path, sourceRoot: sourceRoot())
    }

    private struct Signer {
        let key = Curve25519.Signing.PrivateKey()
        var spki: String {
            (Data([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]) + key.publicKey.rawRepresentation).base64EncodedString()
        }
        func tombstone(id: String, hash: String, atMs: Int64) -> DeliveryTombstone {
            let ts = MeshV2.iso8601(ms: atMs)
            let sig = try! key.signature(for: Data("SERVER_ACCEPTED|\(id)|\(hash)|\(ts)".utf8))
            return DeliveryTombstone(messageId: id, packetHash: hash, timestamp: ts, signature: sig.base64EncodedString())
        }
    }

    private func l2(id: String, priority: Int = 1, atMs: Int64? = nil) -> Data {
        let ts = MeshV2.iso8601(ms: atMs ?? now)
        return Data("{\"encryptedPayload\":\"OPAQUE\",\"envelope\":{\"ackLevel\":\"DEVICE_STORED\",\"location\":null,\"locationStatus\":\"UNKNOWN\",\"priority\":\(priority),\"relayCount\":0,\"timestamp\":\"\(ts)\"},\"id\":\"\(id)\",\"version\":1}".utf8)
    }

    private func node(_ outbox: SosOutboxService, signer: Signer = Signer(), relayId: String = String(repeating: "a", count: 64)) -> MeshV2Node {
        MeshV2Node(outbox: outbox, relayIdHex: relayId, receiptKeySpkiBase64: signer.spki, directory: nil, nowMs: now)
    }

    private func envelopeData(id: String, hop: Int = 0, atMs: Int64? = nil) -> Data {
        var env = MeshCarry.wrap(l2: l2(id: id, atMs: atMs), messageId: id, nowMs: now)
        env.hopCount = hop
        env.copyCount = hop + 1
        env.hopChainReceipt = HopChainReceiptV2(relayDeviceIdHashes: (0 ..< hop).map { String(repeating: String($0), count: 64) })
        return MeshCarry.encode(env)!
    }

    private func ownEntry(_ outbox: SosOutboxService, id: String, atMs: Int64) throws -> OutboxEntryMeta {
        let bytes = l2(id: id, atMs: atMs)
        return try outbox.enqueueLocalSos(input: EnqueueInput(sosId: id, digest: BleProtocol.calculateSHA256(bytes).base64EncodedString(), origin: "ios", encryptedBlobBase64: bytes.base64EncodedString()), nowMs: atMs)
    }

    // MARK: Frames

    func testFramesRoundTrip() {
        let keys = [MeshV2.messageKey("11111111-1111-4111-8111-111111111111"), MeshV2.messageKey("22222222-2222-4222-8222-222222222222")]
        XCTAssertEqual(MeshV2.messageKey("x").count, 16)
        let offer = MeshV2Frame.offer(keys).encode()!
        XCTAssertEqual(offer.count, 2 + 32)
        XCTAssertEqual(offer.first, 0x30)
        XCTAssertEqual(MeshV2Frame.decode(offer), .offer(keys))
        let reply = MeshV2Frame.offerReply([.want, .delivered]).encode()!
        XCTAssertEqual([UInt8](reply), [0x31, 2, 0, 2])
        XCTAssertNil(MeshV2Frame.offer(Array(repeating: keys[0], count: 9)).encode())
        let signer = Signer()
        let t = signer.tombstone(id: "11111111-1111-4111-8111-111111111111", hash: String(repeating: "ab", count: 32), atMs: now)
        let frame = MeshV2Frame.tombstone(t).encode()!
        XCTAssertLessThanOrEqual(frame.count, 170)
        XCTAssertEqual(MeshV2Frame.decode(frame), .tombstone(t))
        XCTAssertFalse(MeshV2Frame.isMeshV2(Data([0x01])))
        XCTAssertTrue(MeshV2Frame.isMeshV2(frame))
    }

    func testMeshInfoAndAdvertisedHops() {
        let info = MeshInfo(hops: 3, flags: MeshInfo.flagRelay | MeshInfo.flagAcceptsCarry, carryFillPercent: 12, secondsSinceConfirmed: 300, selfKey: 0xDEADBEEF, parentKey: 0x01020304)
        let bytes = info.encode()
        XCTAssertEqual(bytes.count, 16)
        XCTAssertEqual([UInt8](bytes.prefix(6)), [0x02, 3, 0x03, 12, 0x01, 0x2C])
        XCTAssertEqual(MeshInfo.decode(bytes), info)
        XCTAssertEqual(MeshV2.hopsServiceUUID(2), "0000FFE2-0000-1000-8000-00805F9B34FB")
        XCTAssertNil(MeshV2.hopsServiceUUID(0xFF))
        XCTAssertEqual(MeshV2.hops(fromServiceUUIDs: ["FFF0", "FFE4"]), 4)
        XCTAssertNil(MeshV2.hops(fromServiceUUIDs: ["FFF0"]))
        XCTAssertEqual(MeshV2.hops(fromServiceData: Data([0x02, 5, 0x01])), 5)
    }

    // MARK: Gateway hops (h)

    func testHopsComputation() {
        let t = GatewayHopsTracker(selfKey: 0xAAAA)
        XCTAssertEqual(t.compute(nowMs: now), MeshV2.offline)
        t.noteInternetSuccess(nowMs: now)
        XCTAssertEqual(t.compute(nowMs: now + 59_000), 0)
        XCTAssertEqual(t.compute(nowMs: now + 61_000), MeshV2.offline, "internet older than 60 s no longer counts")

        let n = GatewayHopsTracker(selfKey: 0xAAAA)
        n.observe(peerId: "gw", hops: 0, selfKey: 1, parentKey: 0, linked: true, nowMs: now)
        n.observe(peerId: "far", hops: 4, nowMs: now)
        XCTAssertEqual(n.compute(nowMs: now), 1, "1 + lowest neighbour")
        XCTAssertEqual(n.parentKey(), 1)
        n.linkLost(peerId: "gw")
        XCTAssertEqual(n.compute(nowMs: now), 1, "hold-down: worse value adopted at most +1 per 15 s")
        XCTAssertEqual(n.compute(nowMs: now + 16_000), 2, "after 15 s it may grow by one")
        XCTAssertEqual(n.compute(nowMs: now + 31_000), MeshV2.offline, "no fresh neighbour left: offline at once")
    }

    func testHopsStaleLoopAndLimits() {
        let t = GatewayHopsTracker(selfKey: 0xBEEF)
        t.observe(peerId: "a", hops: 2, nowMs: now)
        XCTAssertEqual(t.compute(nowMs: now + 30_000), 3)
        XCTAssertEqual(t.compute(nowMs: now + 31_000), MeshV2.offline, "older than 30 s = stale")
        t.observe(peerId: "child", hops: 1, selfKey: 7, parentKey: 0xBEEF, nowMs: now)
        XCTAssertEqual(t.compute(nowMs: now), MeshV2.offline, "never derive from a neighbour whose parent is us")
        t.observe(peerId: "edge", hops: 8, nowMs: now)
        XCTAssertEqual(t.compute(nowMs: now), MeshV2.offline, "h 8 cannot be extended")
        t.observe(peerId: "ok", hops: 7, nowMs: now)
        XCTAssertEqual(t.compute(nowMs: now), 8)
    }

    // MARK: OFFER dedupe

    func testOfferDedupeAndDuplicateReceive() throws {
        let outbox = try makeOutbox()
        let signer = Signer()
        let relay = node(outbox, signer: signer)
        let id = "33333333-3333-4333-8333-333333333333"
        let key = MeshV2.messageKey(id)
        XCTAssertEqual(relay.offerStatus(for: key, nowMs: now), .want)
        guard case .stored = relay.receive(payload: envelopeData(id: id), nowMs: now) else { return XCTFail("not stored") }
        XCTAssertEqual(relay.offerStatus(for: key, nowMs: now), .have)
        XCTAssertEqual(relay.receive(payload: envelopeData(id: id, hop: 1), nowMs: now), .duplicate)
        XCTAssertEqual(relay.carried().count, 1)
        let reply = relay.respond(toControl: MeshV2Frame.offer([key, MeshV2.messageKey("other-message-id")]).encode()!, nowMs: now)
        XCTAssertEqual(reply.first.flatMap { MeshV2Frame.decode($0) }, .offerReply([.have, .want]))
        relay.relayEnabled = false
        XCTAssertEqual(relay.offerStatus(for: MeshV2.messageKey("new-message-id"), nowMs: now), .refused)
    }

    func testCentralSessionSkipsHaveAndNeverResendsToSamePeer() throws {
        let outbox = try makeOutbox()
        let sender = node(outbox)
        _ = try ownEntry(outbox, id: "44444444-4444-4444-8444-444444444444", atMs: now)
        let info = MeshInfo(hops: 0, flags: 3, carryFillPercent: 0, secondsSinceConfirmed: 1, selfKey: 9, parentKey: 0)
        let session = MeshV2CentralSession(node: sender, peerId: "peer-1", peerInfo: info)
        let start = session.start(nowMs: now)
        guard case .writeControl(let offer) = start.first, case .offer(let keys) = MeshV2Frame.decode(offer)! else { return XCTFail("no OFFER") }
        XCTAssertEqual(keys, [MeshV2.messageKey("44444444-4444-4444-8444-444444444444")])
        let actions = session.handleNotification(MeshV2Frame.offerReply([.have]).encode()!, nowMs: now)
        XCTAssertEqual(actions, [.finished], "HAVE: nothing is transferred")
        XCTAssertTrue(sender.candidates(forPeer: "peer-1", peerHops: 0, nowMs: now).isEmpty, "never offered to the same peer again")
        XCTAssertEqual(sender.candidates(forPeer: "peer-2", peerHops: 0, nowMs: now).count, 1)
    }

    func testCentralSessionTransfersWantedAndTimesOut() throws {
        let outbox = try makeOutbox()
        let sender = node(outbox)
        _ = try ownEntry(outbox, id: "55555555-5555-4555-8555-555555555555", atMs: now)
        let session = MeshV2CentralSession(node: sender, peerId: "p", peerInfo: MeshInfo(hops: 1, flags: 3, carryFillPercent: 0, secondsSinceConfirmed: 1, selfKey: 1, parentKey: 0))
        _ = session.start(nowMs: now)
        XCTAssertEqual(session.tick(nowMs: now + 1_000), [])
        let afterTimeout = session.tick(nowMs: now + 2_000)
        guard case .transfer(let sosId, _, let payload) = afterTimeout.first else { return XCTFail("no transfer after reply timeout") }
        XCTAssertEqual(sosId, "55555555-5555-4555-8555-555555555555")
        guard case .envelope(let env, _) = MeshCarry.classify(payload) else { return XCTFail("not L1") }
        XCTAssertEqual(env.hopCount, 0)
        XCTAssertEqual(env.maxHops, 8)
        XCTAssertEqual(session.transferFinished(success: true, nowMs: now), [.finished])
    }

    func testV1PeerGetsBareOwnMessageOnly() throws {
        let outbox = try makeOutbox()
        let sender = node(outbox)
        _ = try ownEntry(outbox, id: "66666666-6666-4666-8666-666666666666", atMs: now)
        let actions = MeshV2CentralSession(node: sender, peerId: "v1", peerInfo: nil).start(nowMs: now)
        guard case .transfer(_, _, let payload) = actions.first, case .bareV1 = MeshCarry.classify(payload) else { return XCTFail("expected bare v1") }
    }

    // MARK: Hop limit and TTL

    func testHopLimitAndTimeTtl() {
        let hash = String(repeating: "f", count: 64)
        var env = MeshCarry.wrap(l2: l2(id: "77777777-7777-4777-8777-777777777777"), messageId: "77777777-7777-4777-8777-777777777777", nowMs: now)
        env.hopCount = 7
        env.copyCount = 8
        guard case .success(let next) = MeshCarry.nextHop(env, selfDeviceHash: hash, nowMs: now) else { return XCTFail("hop 7 must forward") }
        XCTAssertEqual(next.hopCount, 8)
        XCTAssertEqual(next.ttlHops, 7)
        XCTAssertEqual(next.hopChainReceipt.relayDeviceIdHashes.last, hash)
        XCTAssertEqual(MeshCarry.nextHop(next, selfDeviceHash: String(repeating: "e", count: 64), nowMs: now), .failure(.maxHops))
        XCTAssertEqual(MeshCarry.nextHop(next, selfDeviceHash: hash, nowMs: now), .failure(.loopDetected))
        XCTAssertEqual(MeshCarry.nextHop(env, selfDeviceHash: hash, nowMs: now + MeshV2.timeTtlMs + 1_000), .failure(.timeExpired))
    }

    // MARK: Tombstones

    func testTombstoneVerifyPurgesRelayCopyAndKeepsSenderHistory() throws {
        let signer = Signer()
        let relayOutbox = try makeOutbox()
        let relay = node(relayOutbox, signer: signer)
        let id = "88888888-8888-4888-8888-888888888888"
        _ = relay.receive(payload: envelopeData(id: id), nowMs: now)
        XCTAssertEqual(relay.carried().count, 1)
        let hash = MeshV2.sha256Hex(l2(id: id))

        let forged = DeliveryTombstone(messageId: id, packetHash: hash, timestamp: MeshV2.iso8601(ms: now), signature: Data(repeating: 1, count: 64).base64EncodedString())
        XCTAssertFalse(relay.ingestTombstone(forged, nowMs: now))
        XCTAssertFalse(relay.ingestTombstone(Signer().tombstone(id: id, hash: hash, atMs: now), nowMs: now), "other key")
        XCTAssertFalse(relay.ingestTombstone(signer.tombstone(id: id, hash: hash, atMs: now - MeshV2.tombstoneTtlMs - 1_000), nowMs: now), "expired")
        XCTAssertTrue(relay.ingestTombstone(signer.tombstone(id: id, hash: String(repeating: "0", count: 64), atMs: now), nowMs: now))
        XCTAssertEqual(relay.carried().count, 1, "hash mismatch keeps the copy")
        XCTAssertTrue(relay.ingestTombstone(signer.tombstone(id: id, hash: hash, atMs: now), nowMs: now))
        XCTAssertEqual(relay.carried().count, 0, "verified tombstone purges the carried copy")
        XCTAssertEqual(relay.offerStatus(for: MeshV2.messageKey(id), nowMs: now), .delivered)
        XCTAssertEqual(relay.receive(payload: envelopeData(id: id), nowMs: now), .delivered)

        let senderOutbox = try makeOutbox()
        let sender = node(senderOutbox, signer: signer)
        _ = try ownEntry(senderOutbox, id: id, atMs: now)
        XCTAssertEqual(sender.receive(payload: try JSONEncoder().encode(TombstoneBatchV2(items: [signer.tombstone(id: id, hash: hash, atMs: now)])), nowMs: now), .tombstones(applied: 1))
        let own = try senderOutbox.listEntries()
        XCTAssertEqual(own.count, 1, "sender keeps its history")
        XCTAssertEqual(own.first?.state, "SERVER_ACCEPTED")
    }

    func testTombstoneRequestAnswersAndKeyLessBuildNeverPurges() throws {
        let signer = Signer()
        let outbox = try makeOutbox()
        let holder = node(outbox, signer: signer)
        let id = "99999999-9999-4999-8999-999999999999"
        let t = signer.tombstone(id: id, hash: String(repeating: "c", count: 64), atMs: now)
        XCTAssertTrue(holder.ingestTombstone(t, nowMs: now))
        let frames = holder.respond(toControl: MeshV2Frame.tombstoneRequest([MeshV2.messageKey(id)]).encode()!, nowMs: now)
        guard case .tombstone(let answered) = MeshV2Frame.decode(frames.first ?? Data())! else { return XCTFail("no TOMBSTONE") }
        XCTAssertEqual(answered.hopsLeft, 7)
        XCTAssertTrue(TombstoneVerifier(publicKeySpkiBase64: signer.spki).verify(answered, nowMs: now))
        XCTAssertFalse(TombstoneVerifier(publicKeySpkiBase64: "").verify(t, nowMs: now))
    }

    // MARK: Upload order

    func testOwnSosUploadsBeforeRelayedCopies() throws {
        let outbox = try makeOutbox()
        let relay = node(outbox)
        var low = MeshCarry.wrap(l2: l2(id: "relay-low-0001", priority: 5, atMs: now - 10_000), messageId: "relay-low-0001", nowMs: now)
        low.hopCount = 1
        _ = relay.receive(payload: MeshCarry.encode(low)!, nowMs: now - 3_000)
        _ = relay.receive(payload: MeshCarry.encode(MeshCarry.wrap(l2: l2(id: "relay-high-002", priority: 1, atMs: now - 5_000), messageId: "relay-high-002", nowMs: now))!, nowMs: now - 2_000)
        _ = try ownEntry(outbox, id: "own-sos-000001", atMs: now)
        let ordered = MeshUploadOrdering.ordered(try outbox.listEntries()).map(\.sosId)
        XCTAssertEqual(ordered, ["own-sos-000001", "relay-high-002", "relay-low-0001"])
    }

    // MARK: Rate limit (never blocks)

    func testRateLimitCoalescesOrQueues() throws {
        let outbox = try makeOutbox()
        XCTAssertEqual(SosRateLimiter.plan(ownEntries: [], nowMs: now), .sendNow)
        let first = try ownEntry(outbox, id: "rate-0000001", atMs: now)
        XCTAssertEqual(SosRateLimiter.plan(ownEntries: [first], nowMs: now + 30_000), .replace(sosId: first.sosId, digest: first.digest))
        _ = try outbox.updateState(sosId: first.sosId, digest: first.digest, state: "PEER_RECEIVED", nowMs: now + 1, lastError: nil)
        let left = try outbox.listEntries()
        XCTAssertEqual(SosRateLimiter.plan(ownEntries: left, nowMs: now + 30_000), .queueUntil(now + 60_000))
        XCTAssertEqual(SosRateLimiter.plan(ownEntries: left, nowMs: now + 61_000), .sendNow)
    }

    // MARK: Inner payload v2

    func testEmptySosAndOversizeNote() throws {
        let ctx = SosInnerV2Context(senderKey: String(repeating: "1", count: 64), seq: 1, profile: nil, profileChanged: false)
        let empty = try SosInnerPayloadV2Builder.encode(context: ctx, note: nil, location: nil, language: "tr", createdAt: MeshV2.iso8601(ms: now))
        let object = try JSONSerialization.jsonObject(with: empty) as! [String: Any]
        XCTAssertEqual(object["innerVersion"] as? Int, 2)
        XCTAssertNil(object["note"])
        XCTAssertNil(object["profile"])
        var full = ctx
        full.profile = SosProfile(fullName: String(repeating: "A", count: 200), age: 40, address: .init(line: String(repeating: "B", count: 400), city: "Istanbul"), floor: 3, phone: "+905551112233", email: "a@example.com", householdSize: 4)
        full.profileChanged = true
        let big = try SosInnerPayloadV2Builder.encode(context: full, note: String(repeating: "ğ", count: 5_000), location: nil, language: "tr", createdAt: MeshV2.iso8601(ms: now))
        XCTAssertLessThanOrEqual(big.count, MeshV2.maxPayloadBytes)
        let decoded = try JSONSerialization.jsonObject(with: big) as! [String: Any]
        XCTAssertLessThanOrEqual(((decoded["note"] as? String) ?? "").utf8.count, 2000)
        let profile = decoded["profile"] as? [String: Any]
        XCTAssertEqual((profile?["fullName"] as? String)?.count, 100)
        XCTAssertEqual(SosProfile(phone: "0555 111").sanitized().phone, nil)
    }
}
