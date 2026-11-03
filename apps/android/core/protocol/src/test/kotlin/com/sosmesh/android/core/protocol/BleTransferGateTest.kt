package com.sosmesh.android.core.protocol

import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxEntryMeta
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class BleTransferGateTest {
    @Test
    fun badCrcChunk_nackCrcMismatch_chunkNotStored() {
        val clock = SimulatedBleTransferClock()
        val rng = SeededBleTransferRng(5)
        val channel = MockBleTransferChannel(0.0, 0.0, rng)
        val outbound = RecordingOutbound()
        val (senderT, receiverT) = linkedPair(outbound)
        val receiver = BleTransferReceiver(receiverT, TransferConfig(), clock)
        val sender = BleTransferSender(senderT, TransferConfig(maxRetries = 2, chunkTimeoutMs = 300L), clock, rng)
        wireNoOpListeners(sender, receiver)
        sender.startTransfer("CRC_TEST".toByteArray())
        advanceUntil(clock, channel) {
            sender.getState() == TransferState.WAIT_ACK || sender.getState() == TransferState.SENDING
        }
        val bad = ByteArray(20)
        bad[4] = 0x12
        bad[5] = 0x34
        bad[6] = 0x56
        bad[7] = 0x78.toByte()
        receiverT.deliverIncoming(com.sosmesh.android.core.ble.BleMeshConstants.DATA_CHAR_UUID, bad)
        assertTrue(outbound.nacks.any { it.reason == ErrorCode.CRC_MISMATCH })
        assertTrue(receiver.getReceivedChunkSeqs().isEmpty())
    }

    @Test
    fun digestMismatch_receiverFails_senderNeverCompletes_noPeerReceived() {
        val clock = SimulatedBleTransferClock()
        val rng = SeededBleTransferRng(9)
        val outbound = RecordingOutbound()
        val (senderT, receiverT) =
            linkedPair(outbound) { wire ->
                corruptLastChunkDigestIfPresent(wire)
            }
        val sender =
            BleTransferSender(
                senderT,
                TransferConfig(maxRetries = 3, chunkTimeoutMs = 400L),
                clock,
                rng,
            )
        val receiver = BleTransferReceiver(receiverT, TransferConfig(maxRetries = 3, chunkTimeoutMs = 400L), clock)
        val outbox = TrackingOutbox()
        val tracker = SosPeerDeliveryTracker(outbox, testOutboxIoScope())
        tracker.active = SosPeerDeliveryTracker.ActiveTransfer("sos-gate", "digest-gate")
        tracker.attachSenderListener(sender)
        var senderCompleted = false
        receiver.setListener(
            object : BleTransferReceiver.Listener {
                override fun onCompleted(payload: ByteArray) {}

                override fun onFailed(
                    code: ErrorCode,
                    message: String,
                ) {}
            },
        )
        sender.setListener(
            object : BleTransferSender.Listener {
                override fun onCompleted() {
                    senderCompleted = true
                }

                override fun onFailed(
                    code: ErrorCode,
                    message: String,
                ) {}
            },
        )
        sender.startTransfer(ByteArray(320) { 'X'.toByte() })
        repeat(2_000) {
            if (receiver.getState() == TransferState.FAILED || senderCompleted) return@repeat
            clock.advance(10)
        }
        assertEquals(TransferState.FAILED, receiver.getState())
        assertFalse(senderCompleted)
        assertEquals(0, outbox.peerReceivedUpdates.get())
        assertTrue(outbound.nacks.any { it.reason == ErrorCode.DIGEST_INVALID })
    }

    @Test
    fun allChunkAcks_withoutTransferVerified_noPeerReceived() {
        val clock = SimulatedBleTransferClock()
        val rng = SeededBleTransferRng(2)
        lateinit var senderT: GattBleTransferTransport
        val receiverT =
            GattBleTransferTransport(
                object : GattOutboundWriter {
                    override fun writeCharacteristic(
                        uuid: String,
                        value: ByteArray,
                    ) {
                        if (value.isNotEmpty() &&
                            (value[0].toInt() and 0xff) == MessageType.TRANSFER_VERIFIED.wire
                        ) {
                            return
                        }
                        senderT.deliverIncoming(uuid, value)
                    }
                },
            )
        senderT =
            GattBleTransferTransport(
                object : GattOutboundWriter {
                    override fun writeCharacteristic(
                        uuid: String,
                        value: ByteArray,
                    ) {
                        receiverT.deliverIncoming(uuid, value)
                    }
                },
            )
        val receiver = BleTransferReceiver(receiverT, TransferConfig(), clock)
        val config =
            TransferConfig(
                maxRetries = 2,
                chunkTimeoutMs = 200L,
                peerVerifyTimeoutMs = 100L,
            )
        val sender = BleTransferSender(senderT, config, clock, rng)
        val outbox = TrackingOutbox()
        val tracker = SosPeerDeliveryTracker(outbox, testOutboxIoScope())
        tracker.active = SosPeerDeliveryTracker.ActiveTransfer("sos-wait", "d")
        tracker.attachSenderListener(sender)
        wireNoOpListeners(sender, receiver)
        var senderCompleted = false
        var senderFailed = false
        sender.setListener(
            object : BleTransferSender.Listener {
                override fun onCompleted() {
                    senderCompleted = true
                }

                override fun onFailed(
                    code: ErrorCode,
                    message: String,
                ) {
                    senderFailed = true
                }
            },
        )
        sender.startTransfer("WAIT_VERIFIED".toByteArray())
        repeat(500) {
            if (senderCompleted || senderFailed) return@repeat
            clock.advance(10)
        }
        assertFalse(senderCompleted)
        assertTrue(senderFailed)
        assertEquals(0, outbox.peerReceivedUpdates.get())
    }

    private fun linkedPair(
        outbound: RecordingOutbound,
        corruptOutbound: (ByteArray) -> ByteArray = { it },
    ): Pair<GattBleTransferTransport, GattBleTransferTransport> {
        lateinit var senderT: GattBleTransferTransport
        lateinit var receiverT: GattBleTransferTransport
        receiverT =
            GattBleTransferTransport(
                object : GattOutboundWriter {
                    override fun writeCharacteristic(
                        uuid: String,
                        value: ByteArray,
                    ) {
                        outbound.record(value)
                        senderT.deliverIncoming(uuid, value)
                    }
                },
            )
        senderT =
            GattBleTransferTransport(
                object : GattOutboundWriter {
                    override fun writeCharacteristic(
                        uuid: String,
                        value: ByteArray,
                    ) {
                        val wire = corruptOutbound(value)
                        receiverT.deliverIncoming(uuid, wire)
                    }
                },
            )
        return senderT to receiverT
    }

    private fun corruptLastChunkDigestIfPresent(wire: ByteArray): ByteArray {
        val chunk = BleChunkCodec.deserializeChunk(wire) ?: return wire
        if (!ChunkFlags.LAST_CHUNK.has(chunk.header.flags) || chunk.payload.size < 32) return wire
        val extracted = BleChunkCodec.extractDigestFromLastChunk(chunk) ?: return wire
        val (digest, lastData) = extracted
        if (lastData.isEmpty()) return wire
        val corruptedData = lastData.copyOf()
        corruptedData[0] = (corruptedData[0].toInt() xor 0x01).toByte()
        val corruptedPayload = corruptedData + digest
        val header =
            chunk.header.copy(crc32 = BleChunkCodec.calculateCrc32(corruptedPayload))
        return BleChunkCodec.serializeChunk(Chunk(header, corruptedPayload))
    }

    private fun wireNoOpListeners(
        sender: BleTransferSender,
        receiver: BleTransferReceiver,
    ) {
        receiver.setListener(
            object : BleTransferReceiver.Listener {
                override fun onCompleted(payload: ByteArray) {}

                override fun onFailed(
                    code: ErrorCode,
                    message: String,
                ) {}
            },
        )
        sender.setListener(
            object : BleTransferSender.Listener {
                override fun onCompleted() {}

                override fun onFailed(
                    code: ErrorCode,
                    message: String,
                ) {}
            },
        )
    }

    private fun advanceUntil(
        clock: SimulatedBleTransferClock,
        channel: MockBleTransferChannel,
        predicate: () -> Boolean,
    ) {
        runUntil(clock, channel, 500, predicate)
    }

    private fun runUntil(
        clock: SimulatedBleTransferClock,
        channel: MockBleTransferChannel,
        maxSteps: Int,
        predicate: () -> Boolean,
    ) {
        repeat(maxSteps) {
            if (predicate()) return
            clock.advance(10)
            channel.deliverAll()
        }
    }

    private class RecordingOutbound {
        data class NackRecord(val seq: Int, val reason: ErrorCode)

        val nacks = mutableListOf<NackRecord>()
        val verifiedMessages = mutableListOf<ByteArray>()

        fun record(value: ByteArray) {
            if (value.isNotEmpty() && (value[0].toInt() and 0xff) == MessageType.TRANSFER_VERIFIED.wire) {
                verifiedMessages.add(value.copyOf())
            }
            if (value.size >= 4 && (value[0].toInt() and 0xff) == MessageType.NACK.wire) {
                val seq = ((value[1].toInt() and 0xff) shl 8) or (value[2].toInt() and 0xff)
                val reasonWire = value[3].toInt() and 0xff
                val reason = ErrorCode.entries.first { it.wire == reasonWire }
                nacks.add(NackRecord(seq, reason))
            }
        }
    }

    private class TrackingOutbox : OutboxQueueAdapter {
        val peerReceivedUpdates = AtomicInteger(0)

        override suspend fun enqueue(
            input: EnqueueInput,
            nowMs: Long,
        ): OutboxEntryMeta = throw UnsupportedOperationException()

        override suspend fun getByKey(
            sosId: String,
            digest: String,
        ): OutboxEntryMeta? = null

        override suspend fun listAll(): List<OutboxEntryMeta> = emptyList()

        override suspend fun updateState(
            sosId: String,
            digest: String,
            state: String,
            nowMs: Long,
            lastError: String?,
        ): OutboxEntryMeta? {
            if (state == "PEER_RECEIVED") peerReceivedUpdates.incrementAndGet()
            return null
        }

        override suspend fun setRetryAt(
            sosId: String,
            digest: String,
            retryAtMs: Long,
            lastError: String?,
        ) = Unit

        override suspend fun countDueForSend(
            nowMs: Long,
            paused: Boolean,
        ): Int = 0

        override suspend fun purgeExpired(nowMs: Long): Int = 0

        override fun close() = Unit
    }
}
