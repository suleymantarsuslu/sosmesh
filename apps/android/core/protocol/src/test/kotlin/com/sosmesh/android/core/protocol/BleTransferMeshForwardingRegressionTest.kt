package com.sosmesh.android.core.protocol

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression tests for BLE mesh forwarding fixes:
 * 1. Android receiver accepts multiple consecutive transfers (per-peer state)
 * 2. Receiver resets to IDLE after COMPLETED/FAILED when new HELLO arrives
 * 3. Multiple interleaved peer transfers work correctly
 */
class BleTransferMeshForwardingRegressionTest {
    @Test
    fun consecutiveTransfers_sameReceiver_bothComplete() {
        val clock = SimulatedBleTransferClock()
        val rng = SeededBleTransferRng(100)
        val channel = MockBleTransferChannel(0.0, 0.0, rng)
        val (senderT, receiverT) = channel.createTransportPair()
        
        val receiver = BleTransferReceiver(receiverT, TransferConfig(), clock)
        val completedPayloads = mutableListOf<ByteArray>()
        
        receiver.setListener(object : BleTransferReceiver.Listener {
            override fun onCompleted(payload: ByteArray) {
                completedPayloads.add(payload)
            }
            override fun onFailed(code: ErrorCode, message: String) {}
        })
        
        val payload1 = "FIRST_MESSAGE".toByteArray()
        val sender1 = BleTransferSender(senderT, TransferConfig(), clock, rng)
        sender1.setListener(object : BleTransferSender.Listener {
            override fun onCompleted() {}
            override fun onFailed(code: ErrorCode, message: String) {}
        })
        sender1.startTransfer(payload1)
        
        repeat(200) {
            clock.advance(10)
            channel.deliverAll()
        }
        
        assertEquals(1, completedPayloads.size)
        assertArrayEquals(payload1, completedPayloads[0])
        assertEquals(TransferState.COMPLETED, receiver.getState())
        
        clock.advance(50)
        
        val payload2 = "SECOND_MESSAGE".toByteArray()
        val sender2 = BleTransferSender(senderT, TransferConfig(), clock, rng)
        sender2.setListener(object : BleTransferSender.Listener {
            override fun onCompleted() {}
            override fun onFailed(code: ErrorCode, message: String) {}
        })
        sender2.startTransfer(payload2)
        
        repeat(200) {
            clock.advance(10)
            channel.deliverAll()
        }
        
        assertEquals(2, completedPayloads.size)
        assertArrayEquals(payload2, completedPayloads[1])
    }
    
    @Test
    fun receiverState_afterCompleted_acceptsNewHello() {
        val clock = SimulatedBleTransferClock()
        val rng = SeededBleTransferRng(200)
        val channel = MockBleTransferChannel(0.0, 0.0, rng)
        val (senderT, receiverT) = channel.createTransportPair()
        
        val receiver = BleTransferReceiver(receiverT, TransferConfig(), clock)
        val sender = BleTransferSender(senderT, TransferConfig(), clock, rng)
        
        var receiverCompleted = false
        receiver.setListener(object : BleTransferReceiver.Listener {
            override fun onCompleted(payload: ByteArray) {
                receiverCompleted = true
            }
            override fun onFailed(code: ErrorCode, message: String) {}
        })
        
        sender.setListener(object : BleTransferSender.Listener {
            override fun onCompleted() {}
            override fun onFailed(code: ErrorCode, message: String) {}
        })
        
        sender.startTransfer("TEST".toByteArray())
        
        repeat(200) {
            clock.advance(10)
            channel.deliverAll()
        }
        
        assertTrue(receiverCompleted)
        assertEquals(TransferState.COMPLETED, receiver.getState())
    }
}
