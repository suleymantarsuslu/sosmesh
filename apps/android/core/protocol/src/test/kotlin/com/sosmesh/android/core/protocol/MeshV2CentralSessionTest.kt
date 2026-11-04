package com.sosmesh.android.core.protocol

import com.sosmesh.android.core.ble.MeshV2BleHooks
import com.sosmesh.android.core.ble.MeshV2Hooks
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MeshV2CentralSessionTest {
    private class FakeEngine(private val replies: Map<Byte, List<ByteArray>?>) : BleTransferEnginePort {
        val sent = mutableListOf<ByteArray>()
        val exchanged = mutableListOf<Byte>()

        override fun sendOutbound(
            sosId: String,
            digest: String,
            payload: ByteArray,
        ) = Unit

        override fun sendOpaqueForward(payload: ByteArray) {
            sent += payload
        }

        override fun onGattReady() = Unit

        override fun senderState(): TransferState = TransferState.IDLE

        override suspend fun meshV2Exchange(
            frame: ByteArray,
            replyType: Byte,
            windowMs: Long,
            maxFrames: Int,
        ): List<ByteArray>? {
            exchanged += frame[0]
            return replies[replyType]
        }
    }

    private class FakeHooks(private val batch: ByteArray?) : MeshV2BleHooks {
        var tombFrames = 0

        override fun meshInfo(nowMs: Long) = ByteArray(16)

        override fun advertisementServiceData(nowMs: Long) = ByteArray(3)

        override fun onControlFrame(
            value: ByteArray,
            nowMs: Long,
            maxNotifyBytes: Int,
        ): List<ByteArray>? = null

        override fun onAdvertisement(
            peerAddress: String,
            rssi: Int,
            serviceData: ByteArray?,
            shortServiceUuids: List<Int>,
            nowMs: Long,
        ) = Unit

        override fun offerFrame(messageIds: List<String>) = byteArrayOf(0x30, messageIds.size.toByte())

        override fun parseOfferReply(frame: ByteArray): List<Int>? = frame.drop(2).map { it.toInt() }

        override fun tombstoneRequestFrame(messageIds: List<String>) = byteArrayOf(0x32)

        override fun onTombstoneFrames(
            frames: List<ByteArray>,
            nowMs: Long,
        ) {
            tombFrames += frames.size
        }

        override fun takeTombstoneBatchFor(
            peerId: String,
            nowMs: Long,
        ): ByteArray? = batch
    }

    @After
    fun tearDown() {
        MeshV2Hooks.hooks = null
    }

    @Test
    fun v1PeerWithoutMeshInfoSkipsOffer() =
        runBlocking {
            MeshV2Hooks.hooks = FakeHooks(null)
            val r = MeshV2CentralSession.preflight(FakeEngine(mapOf(0x31.toByte() to null)), "p", listOf("a"), 0)
            assertEquals(MeshV2Preflight.V1Peer, r)
        }

    @Test
    fun sendsOnlyWantAndPullsTombstonesForDelivered() =
        runBlocking {
            val hooks = FakeHooks(null)
            MeshV2Hooks.hooks = hooks
            val engine =
                FakeEngine(
                    mapOf(
                        0x31.toByte() to listOf(byteArrayOf(0x31, 3, 0, 1, 2)),
                        0x34.toByte() to listOf(byteArrayOf(0x34)),
                    ),
                )
            val r = MeshV2CentralSession.preflight(engine, "p", listOf("a", "b", "c"), 0) as MeshV2Preflight.Statuses
            assertTrue(r.wants("a"))
            assertFalse(r.wants("b"))
            assertFalse(r.wants("c"))
            assertEquals(listOf<Byte>(0x30, 0x32), engine.exchanged)
            assertEquals(1, hooks.tombFrames)
        }

    @Test
    fun noReplyWithinWindowMeansWantAndTombstoneBatchGoesFirst() =
        runBlocking {
            MeshV2Hooks.hooks = FakeHooks("{\"kind\":\"TOMBSTONES\"}".toByteArray())
            val engine = FakeEngine(mapOf(0x31.toByte() to emptyList()))
            val r = MeshV2CentralSession.preflight(engine, "p", listOf("a"), 0)
            assertEquals(MeshV2Preflight.TombstoneBatchSent, r)
            assertEquals(1, engine.sent.size)
            MeshV2Hooks.hooks = FakeHooks(null)
            val r2 = MeshV2CentralSession.preflight(engine, "p", listOf("a"), 0) as MeshV2Preflight.Statuses
            assertTrue(r2.wants("a"))
        }
}
