package com.sosmesh.android.core.protocol

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BleTransferSimulatedTest {
    @Test
    fun endToEnd_byteEqual() {
        val payload = """{"envelope":{"timestamp":"2026-10-29T18:00:00Z"},"encryptedPayload":"NO_PII"}""".toByteArray()
        val (ok, received) = runTransfer(payload)
        assertTrue(ok)
        assertArrayEquals(payload, received)
    }

    @Test
    fun ackTimeout_backoffAndResumeCompletes() {
        val payload = ("RESUME_" + "X".repeat(200)).toByteArray()
        val (ok, received) = runTransfer(payload, packetLoss = 0.12, seed = 1000)
        assertTrue(ok)
        assertArrayEquals(payload, received)
    }

    @Test
    fun senderCompleted_onlyAfterTransferVerified() {
        val payload = "PEER_ACK_GATE".toByteArray()
        val clock = SimulatedBleTransferClock()
        val rng = SeededBleTransferRng(3)
        val channel = MockBleTransferChannel(0.0, 0.0, rng)
        val (senderT, receiverT) = channel.createTransportPair()
        val sender = BleTransferSender(senderT, TransferConfig(maxRetries = 5, chunkTimeoutMs = 400L), clock, rng)
        val receiver = BleTransferReceiver(receiverT, TransferConfig(maxRetries = 5, chunkTimeoutMs = 400L), clock)
        var senderCompleted = false
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
        receiver.setListener(
            object : BleTransferReceiver.Listener {
                override fun onCompleted(payload: ByteArray) {}

                override fun onFailed(
                    code: ErrorCode,
                    message: String,
                ) {}
            },
        )
        sender.startTransfer(payload)
        repeat(300) {
            clock.advance(10)
            channel.deliverAll()
        }
        assertTrue(senderCompleted)
        assertEquals(TransferState.COMPLETED, sender.getState())
    }

    private fun runTransfer(
        payload: ByteArray,
        packetLoss: Double = 0.0,
        duplicateRate: Double = 0.0,
        seed: Int = 1000,
    ): Pair<Boolean, ByteArray?> {
        val clock = SimulatedBleTransferClock()
        val rng = SeededBleTransferRng(seed)
        val channel = MockBleTransferChannel(packetLoss, duplicateRate, rng)
        val (senderT, receiverT) = channel.createTransportPair()
        val sender =
            BleTransferSender(
                senderT,
                TransferConfig(
                    maxRetries = 20,
                    chunkTimeoutMs = 500L,
                    peerVerifyTimeoutMs = 5_000L,
                ),
                clock,
                rng,
            )
        val receiver = BleTransferReceiver(receiverT, TransferConfig(maxRetries = 20, chunkTimeoutMs = 500L), clock)
        var completed = false
        var failed = false
        var received: ByteArray? = null
        sender.setListener(
            object : BleTransferSender.Listener {
                override fun onCompleted() {
                    completed = true
                }

                override fun onFailed(
                    code: ErrorCode,
                    message: String,
                ) {
                    failed = true
                }
            },
        )
        receiver.setListener(
            object : BleTransferReceiver.Listener {
                override fun onCompleted(payload: ByteArray) {
                    received = payload
                }

                override fun onFailed(
                    code: ErrorCode,
                    message: String,
                ) {
                    failed = true
                }
            },
        )
        sender.startTransfer(payload)
        val deadline = clock.now() + 400_000L
        while (clock.now() < deadline && !completed && !failed) {
            clock.advance(10)
            channel.deliverAll()
        }
        return (completed && !failed) to received
    }
}
