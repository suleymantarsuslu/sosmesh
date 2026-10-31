package com.sosmesh.android.core.protocol

import org.junit.Assert.assertArrayEquals
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
        val clock = SimulatedBleTransferClock()
        val rng = SeededBleTransferRng(1000)
        val channel = MockBleTransferChannel(0.08, 0.0, rng)
        val (senderT, receiverT) = channel.createTransportPair()
        val config = TransferConfig(maxRetries = 12, chunkTimeoutMs = 400L, windowSize = 2)
        val sender = BleTransferSender(senderT, config, clock, rng)
        val receiver = BleTransferReceiver(receiverT, config, clock)
        var completed = false
        sender.setListener(
            object : BleTransferSender.Listener {
                override fun onCompleted() {
                    completed = true
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
        var steps = 0
        while (!completed && steps < 50_000) {
            clock.advance(10)
            channel.deliverAll()
            steps++
        }
        assertTrue(completed)
    }

    @Test
    fun senderCompleted_onlyAfterAllAcks() {
        val payload = "PEER_ACK_GATE".toByteArray()
        val clock = SimulatedBleTransferClock()
        val rng = SeededBleTransferRng(3)
        val channel = MockBleTransferChannel(0.0, 0.0, rng)
        val (senderT, receiverT) = channel.createTransportPair()
        val sender = BleTransferSender(senderT, TransferConfig(maxRetries = 5, chunkTimeoutMs = 400L), clock, rng)
        BleTransferReceiver(receiverT, TransferConfig(maxRetries = 5, chunkTimeoutMs = 400L), clock)
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
        sender.startTransfer(payload)
        repeat(200) {
            clock.advance(10)
            channel.deliverAll()
        }
        assertTrue(senderCompleted)
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
        val sender = BleTransferSender(senderT, TransferConfig(maxRetries = 8, chunkTimeoutMs = 500L), clock, rng)
        val receiver = BleTransferReceiver(receiverT, TransferConfig(maxRetries = 8, chunkTimeoutMs = 500L), clock)
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
        val deadline = clock.now() + 200_000L
        while (clock.now() < deadline && !completed && !failed) {
            clock.advance(10)
            channel.deliverAll()
        }
        return (completed && !failed) to received
    }
}
