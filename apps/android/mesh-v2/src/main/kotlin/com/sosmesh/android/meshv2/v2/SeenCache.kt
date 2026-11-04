package com.sosmesh.android.meshv2.v2

enum class SeenState { CARRYING, FORWARDED, DELIVERED, DROPPED }

/** §3.1 seen cache: messageKey → state, 72 h, LRU cap 4096. */
class SeenCache(
    private val cap: Int = 4096,
    private val ttlMs: Long = 72L * 3_600_000L,
) {
    private data class Entry(val firstSeenMs: Long, var state: SeenState)

    private val map = LinkedHashMap<MessageKey, Entry>(64, 0.75f, true)
    private val lock = Any()

    fun state(
        key: MessageKey,
        nowMs: Long,
    ): SeenState? =
        synchronized(lock) {
            val e = map[key] ?: return null
            if (nowMs - e.firstSeenMs > ttlMs) {
                map.remove(key)
                null
            } else {
                e.state
            }
        }

    /** Records the key; never downgrades DELIVERED. Returns true when the key was new. */
    fun mark(
        key: MessageKey,
        state: SeenState,
        nowMs: Long,
    ): Boolean =
        synchronized(lock) {
            val existing = map[key]?.takeIf { nowMs - it.firstSeenMs <= ttlMs }
            if (existing == null) {
                map[key] = Entry(nowMs, state)
                while (map.size > cap) map.remove(map.keys.first())
                true
            } else {
                if (existing.state != SeenState.DELIVERED) existing.state = state
                false
            }
        }

    fun size(): Int = synchronized(lock) { map.size }
}

/**
 * Peripheral-side OFFER answer (§5.2): DELIVERED if we hold a tombstone, HAVE if seen, FULL if carry full,
 * REFUSED if relay off, else WANT.
 */
class OfferResponder(
    private val seen: SeenCache,
    private val tombstones: TombstoneStore,
) {
    fun reply(
        keys: List<MessageKey>,
        nowMs: Long,
        relayEnabled: Boolean,
        carryHasRoom: Boolean,
    ): List<OfferStatus> {
        val inFrame = HashSet<MessageKey>()
        return keys.map { key ->
            when {
                tombstones.get(key) != null -> OfferStatus.DELIVERED
                seen.state(key, nowMs) == SeenState.DELIVERED -> OfferStatus.DELIVERED
                seen.state(key, nowMs) != null || !inFrame.add(key) -> OfferStatus.HAVE
                !relayEnabled -> OfferStatus.REFUSED
                !carryHasRoom -> OfferStatus.FULL
                else -> OfferStatus.WANT
            }
        }
    }
}
