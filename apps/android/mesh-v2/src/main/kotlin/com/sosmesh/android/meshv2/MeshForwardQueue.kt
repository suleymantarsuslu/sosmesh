package com.sosmesh.android.meshv2

import com.sosmesh.contracts.meshv2.MeshRelayEnvelopeV2

enum class MeshForwardPriority {
    SOS,
    BROADCAST,
    OTHER,
}

data class MeshForwardQueueItem(
    val envelope: MeshRelayEnvelopeV2,
    val wireBytes: ByteArray,
    val enqueuedAtMs: Long,
    val priority: MeshForwardPriority = MeshForwardPriority.SOS,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as MeshForwardQueueItem
        return envelope.messageId == other.envelope.messageId &&
            envelope.hopCount == other.envelope.hopCount &&
            wireBytes.contentEquals(other.wireBytes)
    }

    override fun hashCode(): Int {
        var result = envelope.messageId.hashCode()
        result = 31 * result + envelope.hopCount
        result = 31 * result + wireBytes.contentHashCode()
        return result
    }
}

enum class MeshForwardEvictionReason {
    QueueCapacity,
    BatteryQuota,
}

data class MeshForwardQueueSnapshot(
    val depth: Int,
    val lastEviction: MeshForwardEvictionReason?,
)

/**
 * Store-carry-forward queue with SOS-priority eviction (lower TTL expires first).
 */
class MeshForwardQueue(
    private val maxDepth: Int,
) {
    private val items = ArrayDeque<MeshForwardQueueItem>()
    private var lastEviction: MeshForwardEvictionReason? = null
    private val lock = Any()

    fun enqueue(
        item: MeshForwardQueueItem,
        batteryQuotaAllowsEnqueue: Boolean,
    ): MeshForwardQueueSnapshot =
        synchronized(lock) {
            if (!batteryQuotaAllowsEnqueue) {
                lastEviction = MeshForwardEvictionReason.BatteryQuota
                return snapshotLocked()
            }
            items.addLast(item)
            items.sortWith(
                compareBy<MeshForwardQueueItem> { it.priority }
                    .thenBy { it.envelope.ttlHops }
                    .thenBy { it.envelope.copyCount }
                    .thenBy { it.enqueuedAtMs },
            )
            while (items.size > maxDepth) {
                items.removeLast()
                lastEviction = MeshForwardEvictionReason.QueueCapacity
            }
            snapshotLocked()
        }

    fun pollNext(): MeshForwardQueueItem? =
        synchronized(lock) {
            items.removeFirstOrNull()
        }

    fun peekNext(): MeshForwardQueueItem? =
        synchronized(lock) {
            items.firstOrNull()
        }

    fun snapshot(): MeshForwardQueueSnapshot =
        synchronized(lock) {
            snapshotLocked()
        }

    private fun snapshotLocked(): MeshForwardQueueSnapshot =
        MeshForwardQueueSnapshot(
            depth = items.size,
            lastEviction = lastEviction,
        )
}
