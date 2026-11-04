package com.sosmesh.android.meshv2

import com.sosmesh.contracts.meshv2.HopChainReceiptV2
import com.sosmesh.contracts.meshv2.MeshRelayEnvelopeV2
import org.junit.Assert.assertEquals
import org.junit.Test

class MeshForwardQueuePriorityTest {
    @Test
    fun sos_hasHigherPriorityThanBroadcast() {
        val queue = MeshForwardQueue(maxDepth = 10)

        val broadcast =
            MeshForwardQueueItem(
                envelope =
                    MeshRelayEnvelopeV2(
                        messageId = "broadcast-1",
                        hopCount = 0,
                        ttlHops = 8,
                        copyCount = 1,
                        hopChainReceipt = HopChainReceiptV2(),
                    ),
                wireBytes = ByteArray(100),
                enqueuedAtMs = System.currentTimeMillis(),
                priority = MeshForwardPriority.BROADCAST,
            )

        val sos =
            MeshForwardQueueItem(
                envelope =
                    MeshRelayEnvelopeV2(
                        messageId = "sos-1",
                        hopCount = 0,
                        ttlHops = 8,
                        copyCount = 1,
                        hopChainReceipt = HopChainReceiptV2(),
                    ),
                wireBytes = ByteArray(100),
                enqueuedAtMs = System.currentTimeMillis() + 1000,
                priority = MeshForwardPriority.SOS,
            )

        queue.enqueue(broadcast, batteryQuotaAllowsEnqueue = true)
        queue.enqueue(sos, batteryQuotaAllowsEnqueue = true)

        val first = queue.pollNext()
        assertEquals("sos-1", first?.envelope?.messageId)

        val second = queue.pollNext()
        assertEquals("broadcast-1", second?.envelope?.messageId)
    }

    @Test
    fun broadcast_respects_ttlHops_withinPriority() {
        val queue = MeshForwardQueue(maxDepth = 10)

        val broadcast1 =
            MeshForwardQueueItem(
                envelope =
                    MeshRelayEnvelopeV2(
                        messageId = "broadcast-1",
                        hopCount = 0,
                        ttlHops = 2,
                        copyCount = 1,
                        hopChainReceipt = HopChainReceiptV2(),
                    ),
                wireBytes = ByteArray(100),
                enqueuedAtMs = System.currentTimeMillis(),
                priority = MeshForwardPriority.BROADCAST,
            )

        val broadcast2 =
            MeshForwardQueueItem(
                envelope =
                    MeshRelayEnvelopeV2(
                        messageId = "broadcast-2",
                        hopCount = 0,
                        ttlHops = 5,
                        copyCount = 1,
                        hopChainReceipt = HopChainReceiptV2(),
                    ),
                wireBytes = ByteArray(100),
                enqueuedAtMs = System.currentTimeMillis(),
                priority = MeshForwardPriority.BROADCAST,
            )

        queue.enqueue(broadcast2, batteryQuotaAllowsEnqueue = true)
        queue.enqueue(broadcast1, batteryQuotaAllowsEnqueue = true)

        val first = queue.pollNext()
        assertEquals("broadcast-1", first?.envelope?.messageId)
    }
}
