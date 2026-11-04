package com.sosmesh.android.meshv2.v2

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.KeyPairGenerator
import java.security.Signature
import java.time.Instant
import java.util.Base64

class MeshV2CoreTest {
    private val now = Instant.parse("2026-11-04T02:00:00Z").toEpochMilli()
    private val relayId = "a".repeat(64)
    private val selfHash = "b".repeat(64)

    private val keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
    private val spki = Base64.getEncoder().encodeToString(keyPair.public.encoded)

    private fun sign(
        id: String,
        hash: String,
        ts: String,
    ): DeliveryTombstone {
        val s = Signature.getInstance("Ed25519")
        s.initSign(keyPair.private)
        s.update("SERVER_ACCEPTED|$id|$hash|$ts".toByteArray())
        return DeliveryTombstone(messageId = id, packetHash = hash, timestamp = ts, signature = Base64.getEncoder().encodeToString(s.sign()))
    }

    private fun node() =
        MeshV2Node(verifier = TombstoneVerifier(SpkiEd25519Verifier(spki)), selfDeviceIdHash = selfHash, relayIdHex = relayId)

    private fun l1(
        id: String,
        hop: Int = 0,
        created: String = "2026-11-04T01:00:00Z",
        chain: String = "",
    ): ByteArray {
        val l2 = """{"version":1,"id":"$id","envelope":{"timestamp":"$created","priority":2},"encryptedPayload":"x"}"""
        val b64 = Base64.getEncoder().encodeToString(l2.toByteArray())
        val c = if (chain.isEmpty()) "" else "\"$chain\""
        return (
            """{"protocolVersion":2,"messageId":"$id","hopCount":$hop,"maxHops":8,"ttlHops":${8 - hop},"copyCount":1,""" +
                """"maxCopyCount":4,"originCreatedAt":"$created","opaqueCiphertextBase64":"$b64",""" +
                """"hopChainReceipt":{"relayDeviceIdHashes":[$c]},"peerAckHint":"PEER_RECEIVED_ONLY"}"""
        ).toByteArray()
    }

    private val hashOf: (ByteArray) -> String = { MeshV2Wire.hex(MeshV2Wire.sha256(it)) }

    @Test
    fun messageKeyIsFirst16BytesOfSha256() {
        val id = "3f2b8c1e-0000-4000-8000-000000000001"
        val k = MeshV2Wire.messageKey(id)
        assertEquals(MeshV2Wire.hex(MeshV2Wire.sha256(id.toByteArray())).take(32), k.hex)
    }

    @Test
    fun offerFramesRoundTrip() {
        val keys = (1..3).map { MeshV2Wire.messageKey("id-$it") }
        val bytes = MeshV2FrameCodec.encodeOffer(keys)
        assertEquals(2 + 48, bytes.size)
        assertEquals(0x30, bytes[0].toInt())
        assertEquals(MeshV2Frame.Offer(keys), MeshV2FrameCodec.decode(bytes))
        val reply = MeshV2FrameCodec.encodeOfferReply(listOf(OfferStatus.WANT, OfferStatus.HAVE, OfferStatus.DELIVERED))
        assertArrayEquals(byteArrayOf(0x31, 3, 0, 1, 2), reply)
        assertNull(MeshV2FrameCodec.decode(byteArrayOf(0x30, 9)))
    }

    @Test
    fun offerDedupe_secondOfferOfSameKeyIsHave() {
        val n = node()
        val id = "11111111-1111-4111-8111-111111111111"
        val key = MeshV2Wire.messageKey(id)
        val first = n.onControlFrame(MeshV2FrameCodec.encodeOffer(listOf(key)), now, 185)
        assertEquals(MeshV2Frame.OfferReply(listOf(OfferStatus.WANT)), MeshV2FrameCodec.decode(first.single()))
        assertTrue(n.onTransferPayload(l1(id), now, hashOf) is ReceiveOutcome.Stored)
        val second = n.onControlFrame(MeshV2FrameCodec.encodeOffer(listOf(key, key)), now + 1000, 185)
        assertEquals(MeshV2Frame.OfferReply(listOf(OfferStatus.HAVE, OfferStatus.HAVE)), MeshV2FrameCodec.decode(second.single()))
        assertTrue(n.onTransferPayload(l1(id), now + 2000, hashOf) is ReceiveOutcome.Dropped)
    }

    @Test
    fun offerDuplicateInsideOneFrameIsHave() {
        val n = node()
        val key = MeshV2Wire.messageKey("dup")
        val r = n.onControlFrame(MeshV2FrameCodec.encodeOffer(listOf(key, key)), now, 185)
        assertEquals(MeshV2Frame.OfferReply(listOf(OfferStatus.WANT, OfferStatus.HAVE)), MeshV2FrameCodec.decode(r.single()))
    }

    @Test
    fun hopLimitAndTimeTtlAndLoop() {
        val n = node()
        assertTrue(n.onTransferPayload(l1("a-hop7", hop = 7), now, hashOf) is ReceiveOutcome.Stored)
        assertEquals(ReceiveOutcome.Dropped("MAX_HOPS"), n.onTransferPayload(l1("a-hop8", hop = 8), now, hashOf))
        assertEquals(
            ReceiveOutcome.Dropped("TIME_EXPIRED"),
            n.onTransferPayload(l1("a-old", created = "2026-11-03T01:59:59Z"), now, hashOf),
        )
        assertEquals(ReceiveOutcome.Dropped("LOOP_DETECTED"), n.onTransferPayload(l1("a-loop", chain = selfHash), now, hashOf))
    }

    @Test
    fun meshInfoAndAdvertisementEncodings() {
        val info = MeshInfo(h = 2, flags = 0x0B, carryFillPercent = 40, secondsSinceConfirmed = 70000, selfKey = 0x01020304, parentKey = -1)
        val bytes = info.encode()
        assertEquals(16, bytes.size)
        assertEquals(info.copy(secondsSinceConfirmed = 0xFFFF), MeshInfo.decode(bytes))
        assertArrayEquals(byteArrayOf(2, 3, 1), MeshV2Advertisement.androidServiceData(3, 1))
        assertEquals(MeshV2Advertisement.Parsed(0xFF, 0), MeshV2Advertisement.parseAndroidServiceData(byteArrayOf(2, -1, 0)))
        assertEquals(2, MeshV2Advertisement.parseIosHopsUuids(listOf(0xFFF0, 0xFFE2)))
        assertEquals(0xFF, MeshV2Advertisement.parseIosHopsUuids(listOf(0xFFF0)))
    }

    @Test
    fun hComputation_gatewayNeighbourStaleAndParentLoop() {
        val t = GatewayHopsTracker()
        val self = 42
        assertEquals(0xFF, t.compute(self, now).h)
        t.onApiReachable(now)
        assertEquals(0, t.compute(self, now + 59_000).h)
        // gateway expired, neighbour at h=0 fresh ⇒ 1
        t.onNeighbour(GatewayHopsTracker.Neighbour("p1", 0, 7, 0, now + 60_000, false, -60))
        assertEquals(1, t.compute(self, now + 61_000).h)
        // stale (31 s) and no other ⇒ offline immediately
        assertEquals(0xFF, t.compute(self, now + 91_001).h)
        // neighbour whose parent is us is ignored
        t.onNeighbour(GatewayHopsTracker.Neighbour("p2", 1, 9, self, now + 100_000, true, -50))
        assertEquals(0xFF, t.compute(self, now + 100_000).h)
        // h_n = 8 not usable
        t.onNeighbour(GatewayHopsTracker.Neighbour("p3", 8, 10, 0, now + 100_000, true, -50))
        assertEquals(0xFF, t.compute(self, now + 100_001).h)
        t.onNeighbour(GatewayHopsTracker.Neighbour("p4", 3, 11, 0, now + 100_000, true, -50))
        assertEquals(4, t.compute(self, now + 100_002).h)
    }

    @Test
    fun hHoldDownLimitsIncrease() {
        val t = GatewayHopsTracker()
        t.onNeighbour(GatewayHopsTracker.Neighbour("a", 0, 1, 0, now, true, -50))
        assertEquals(1, t.compute(9, now).h)
        t.onNeighbour(GatewayHopsTracker.Neighbour("a", 5, 1, 0, now + 1000, true, -50))
        assertEquals(2, t.compute(9, now + 1000).h)
        assertEquals(2, t.compute(9, now + 5000).h)
        assertEquals(3, t.compute(9, now + 16_500).h)
    }

    @Test
    fun tombstonePurgesRelayCopyAndKeepsSenderHistory() {
        val n = node()
        val relayId1 = "22222222-2222-4222-8222-222222222222"
        assertTrue(n.onTransferPayload(l1(relayId1), now, hashOf) is ReceiveOutcome.Stored)
        val copy = n.carry.ordered().single()
        val ownId = "33333333-3333-4333-8333-333333333333"
        n.addOwn(ownId, "own".toByteArray(), "c".repeat(64), now, now)
        val ts = "2026-11-04T01:30:00.000Z"
        val result = n.applyTombstones(listOf(sign(relayId1, copy.packetHash, ts), sign(ownId, "c".repeat(64), ts)), now)
        assertEquals(1, result.purged)
        assertEquals(1, result.accepted)
        assertTrue(n.carry.ordered().isEmpty())
        assertTrue(n.carry.isOwnAccepted(MeshV2Wire.messageKey(ownId)))
        val reply = n.onControlFrame(MeshV2FrameCodec.encodeOffer(listOf(MeshV2Wire.messageKey(relayId1))), now, 185)
        assertEquals(MeshV2Frame.OfferReply(listOf(OfferStatus.DELIVERED)), MeshV2FrameCodec.decode(reply.single()))
        val tombFrames = n.onControlFrame(MeshV2FrameCodec.encodeTombstoneRequest(listOf(MeshV2Wire.messageKey(relayId1))), now, 185)
        val decoded = MeshV2FrameCodec.decode(tombFrames.single()) as MeshV2Frame.Tombstone
        assertEquals(7, decoded.tombstone.hopsLeft)
        assertTrue(TombstoneVerifier(SpkiEd25519Verifier(spki)).isValid(decoded.tombstone, now))
    }

    @Test
    fun badTombstonesDoNotPurge() {
        val n = node()
        val id = "44444444-4444-4444-8444-444444444444"
        n.onTransferPayload(l1(id), now, hashOf)
        val hash = n.carry.ordered().single().packetHash
        val badSig = sign(id, hash, "2026-11-04T01:30:00.000Z").copy(timestamp = "2026-11-04T01:30:01.000Z")
        val expired = sign(id, hash, "2026-11-01T01:00:00.000Z")
        val mismatch = sign(id, "d".repeat(64), "2026-11-04T01:30:00.000Z")
        val r = n.applyTombstones(listOf(badSig, expired, mismatch), now)
        assertEquals(0, r.purged)
        assertEquals(1, n.carry.ordered().size)
        assertNull(n.tombstones.get(MeshV2Wire.messageKey(id)))
        val noKey = MeshV2Node(verifier = TombstoneVerifier(SpkiEd25519Verifier("")), selfDeviceIdHash = selfHash, relayIdHex = relayId)
        assertFalse(TombstoneVerifier(SpkiEd25519Verifier("")).isValid(sign(id, hash, "2026-11-04T01:30:00.000Z"), now))
        assertNotNull(noKey)
    }

    @Test
    fun ownFirstOrdering() {
        val items =
            listOf(
                CarryItem("c1", ByteArray(1), "h", priority = 1, originCreatedAtMs = 100, hopCount = 1, own = false),
                CarryItem("o2", ByteArray(1), "h", priority = 5, originCreatedAtMs = 300, hopCount = 0, own = true),
                CarryItem("c2", ByteArray(1), "h", priority = 1, originCreatedAtMs = 50, hopCount = 1, own = false),
                CarryItem("o1", ByteArray(1), "h", priority = 5, originCreatedAtMs = 200, hopCount = 0, own = true),
                CarryItem("c0", ByteArray(1), "h", priority = 0, originCreatedAtMs = 999, hopCount = 1, own = false),
            )
        assertEquals(listOf("o1", "o2", "c0", "c2", "c1"), UploadOrder.sort(items).map { it.messageId })
    }

    @Test
    fun rateLimiterCoalescesOrQueuesNeverRefuses() {
        val r = SosRateLimiter()
        assertEquals(SosRateLimiter.Decision.SendNow, r.decide(now, null, false))
        assertEquals(SosRateLimiter.Decision.ReplacePrevious("m1"), r.decide(now + 30_000, "m1", false))
        assertEquals(SosRateLimiter.Decision.Queue(now + 60_000), r.decide(now + 30_000, "m1", true))
        assertEquals(SosRateLimiter.Decision.SendNow, r.decide(now + 60_000, "m1", true))
    }

    @Test
    fun sprayLimitFourDistinctPeersAndCopyCap16() {
        val n = node()
        val item = CarryItem("s1", ByteArray(1), "h", 1, now, 1, own = false)
        assertTrue((1..4).all { n.claimForward(item, "p$it", peerCloserToGateway = false) })
        assertFalse(n.claimForward(item, "p5", peerCloserToGateway = false))
        assertFalse(n.claimForward(item, "p1", peerCloserToGateway = true))
        assertTrue(n.claimForward(item, "gw", peerCloserToGateway = true))
        assertEquals(16, n.forwardEnvelope(item, 1)!!.maxCopyCount)
    }
}
