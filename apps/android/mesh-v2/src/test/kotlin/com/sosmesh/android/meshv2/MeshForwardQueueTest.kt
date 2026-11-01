package com.sosmesh.android.meshv2

import com.sosmesh.contracts.meshv2.MeshRelayEnvelopeV2
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class MeshRouteSelectorTest {
    @Test
    fun selectBestPeer_prefersInternetAndBattery() {
        val selector = MeshRouteSelector()
        val choice =
            selector.selectBestPeer(
                listOf(
                    MeshPeerCandidate("offline-low", hasInternetCapability = false, batteryPercent = 20, queuePressure = 0),
                    MeshPeerCandidate("online-healthy", hasInternetCapability = true, batteryPercent = 80, queuePressure = 1),
                ),
            )
        assertNotNull(choice)
        assertEquals("online-healthy", choice?.peerId)
    }
}

class MeshForwardQueueTest {
    @Test
    fun queue_evicts_lowest_priority_when_over_capacity() {
        val queue = MeshForwardQueue(maxDepth = 2)
        val envelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "q1",
                hopCount = 0,
                maxHops = 5,
                ttlHops = 1,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "YQ==",
                hopChainReceipt = com.sosmesh.contracts.meshv2.HopChainReceiptV2(),
            )
        queue.enqueue(MeshForwardQueueItem(envelope, byteArrayOf(1), 1L), batteryQuotaAllowsEnqueue = true)
        val highTtl =
            envelope.copy(messageId = "q2", ttlHops = 5)
        queue.enqueue(MeshForwardQueueItem(highTtl, byteArrayOf(2), 2L), batteryQuotaAllowsEnqueue = true)
        val newest =
            envelope.copy(messageId = "q3", ttlHops = 4)
        queue.enqueue(MeshForwardQueueItem(newest, byteArrayOf(3), 3L), batteryQuotaAllowsEnqueue = true)
        val first = queue.pollNext()
        assertNotNull(first)
        assertEquals("q1", first?.envelope?.messageId)
    }

    @Test
    fun battery_quota_blocks_enqueue() {
        val queue = MeshForwardQueue(maxDepth = 4)
        val envelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "bat",
                hopCount = 0,
                maxHops = 5,
                ttlHops = 2,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "Yg==",
                hopChainReceipt = com.sosmesh.contracts.meshv2.HopChainReceiptV2(),
            )
        val snap =
            queue.enqueue(
                MeshForwardQueueItem(envelope, byteArrayOf(9), 1L),
                batteryQuotaAllowsEnqueue = false,
            )
        assertEquals(0, snap.depth)
        assertEquals(MeshForwardEvictionReason.BatteryQuota, snap.lastEviction)
        assertNull(queue.pollNext())
    }
}
