package com.sosmesh.android.meshv2.v2

import java.time.Instant

data class BroadcastCarryItem(
    val id: String,
    val wireBytes: ByteArray,
    val expiresAt: String,
    val hopsLeft: Int,
    val addedAtMs: Long,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as BroadcastCarryItem
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}

class BroadcastCarryStore(private val maxCapacity: Int = 50) {
    private val items = mutableMapOf<String, BroadcastCarryItem>()

    @Synchronized
    fun add(item: BroadcastCarryItem): Boolean {
        if (items.containsKey(item.id)) return false
        
        val now = Instant.now()
        items.values.removeAll { Instant.parse(it.expiresAt).isBefore(now) }
        
        if (items.size >= maxCapacity) return false
        
        items[item.id] = item
        return true
    }

    @Synchronized
    fun get(id: String): BroadcastCarryItem? = items[id]

    @Synchronized
    fun getAll(nowMs: Long): List<BroadcastCarryItem> {
        val now = Instant.now()
        return items
            .values
            .filter { Instant.parse(it.expiresAt).isAfter(now) && it.hopsLeft > 0 }
            .toList()
    }

    @Synchronized
    fun markSeen(id: String) {
        items.remove(id)
    }
}
