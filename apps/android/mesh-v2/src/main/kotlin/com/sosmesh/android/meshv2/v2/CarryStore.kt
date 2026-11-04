package com.sosmesh.android.meshv2.v2

/** One carried L1 copy. [l2Bytes] are the opaque v1 wire bytes, never re-serialized. */
class CarryItem(
    val messageId: String,
    val l2Bytes: ByteArray,
    val packetHash: String,
    val priority: Int,
    val originCreatedAtMs: Long,
    val hopCount: Int,
    val own: Boolean,
    val relayChain: List<String> = emptyList(),
) {
    val messageKey: MessageKey = MeshV2Wire.messageKey(messageId)

    private val forwardedTo = LinkedHashSet<String>()

    fun forwardedPeerCount(): Int = synchronized(forwardedTo) { forwardedTo.size }

    fun claimPeer(
        peerId: String,
        limit: Int,
    ): Boolean =
        synchronized(forwardedTo) {
            when {
                peerId in forwardedTo -> false
                forwardedTo.size >= limit -> false
                else -> forwardedTo.add(peerId)
            }
        }
}

enum class PurgeResult { PURGED, HASH_MISMATCH, NOT_FOUND, OWN_MARKED_ACCEPTED }

/**
 * Carry store + own outbox view (§3.1, §6, §9). Own items are never evicted or purged; a tombstone marks
 * them accepted (sender history kept). Relay copies are deleted on a verified tombstone with matching packetHash.
 */
class CarryStore(
    private val maxItems: Int = 200,
    private val maxBytes: Int = 2 * 1024 * 1024,
    private val timeTtlMs: Long = 24L * 3_600_000L,
) {
    private val items = LinkedHashMap<MessageKey, CarryItem>()
    private val ownAccepted = HashSet<MessageKey>()
    private val lock = Any()

    fun put(item: CarryItem): Boolean =
        synchronized(lock) {
            if (items.containsKey(item.messageKey)) return false
            items[item.messageKey] = item
            evictLocked()
            items.containsKey(item.messageKey)
        }

    fun contains(key: MessageKey): Boolean = synchronized(lock) { items.containsKey(key) }

    fun hasRoom(): Boolean = synchronized(lock) { items.values.count { !it.own } < maxItems }

    fun fillPercent(): Int = synchronized(lock) { (items.values.count { !it.own } * 100 / maxItems).coerceIn(0, 100) }

    fun isOwnAccepted(key: MessageKey): Boolean = synchronized(lock) { key in ownAccepted }

    fun applyTombstone(t: DeliveryTombstone): PurgeResult =
        synchronized(lock) {
            val key = t.messageKey
            val item = items[key] ?: return PurgeResult.NOT_FOUND
            if (item.packetHash != t.packetHash) return PurgeResult.HASH_MISMATCH
            if (item.own) {
                ownAccepted += key
                items.remove(key)
                return PurgeResult.OWN_MARKED_ACCEPTED
            }
            items.remove(key)
            PurgeResult.PURGED
        }

    fun purgeExpired(nowMs: Long): Int =
        synchronized(lock) {
            val before = items.size
            items.values.removeAll { !it.own && nowMs > it.originCreatedAtMs + timeTtlMs }
            before - items.size
        }

    /** §9 upload / forward order: own oldest first, then carry by priority asc, then originCreatedAt asc. */
    fun ordered(): List<CarryItem> = synchronized(lock) { UploadOrder.sort(items.values.toList()) }

    fun remove(key: MessageKey) = synchronized(lock) { items.remove(key) }

    private fun evictLocked() {
        fun carryBytes() = items.values.filter { !it.own }.sumOf { it.l2Bytes.size }
        while (items.values.count { !it.own } > maxItems || carryBytes() > maxBytes) {
            val victim = items.values.filter { !it.own }.minByOrNull { it.originCreatedAtMs } ?: break
            items.remove(victim.messageKey)
        }
    }
}

object UploadOrder {
    fun sort(items: List<CarryItem>): List<CarryItem> =
        items.sortedWith(
            compareBy<CarryItem> { if (it.own) 0 else 1 }
                .thenBy { if (it.own) 0 else it.priority }
                .thenBy { it.originCreatedAtMs },
        )
}
