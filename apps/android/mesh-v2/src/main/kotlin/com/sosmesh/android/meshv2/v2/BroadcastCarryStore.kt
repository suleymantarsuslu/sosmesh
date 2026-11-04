package com.sosmesh.android.meshv2.v2

import java.util.concurrent.ConcurrentHashMap

data class CarriedBroadcast(
    val id: String,
    val broadcast: ServerBroadcast,
    val receivedAtMs: Long,
)

class BroadcastCarryStore(
    private val maxCapacity: Int = 20,
) {
    private val carried = ConcurrentHashMap<String, CarriedBroadcast>()

    fun put(broadcast: ServerBroadcast, receivedAtMs: Long): Boolean {
        if (carried.size >= maxCapacity && !carried.containsKey(broadcast.id)) {
            return false
        }
        carried[broadcast.id] = CarriedBroadcast(broadcast.id, broadcast, receivedAtMs)
        return true
    }

    fun contains(id: String): Boolean = carried.containsKey(id)

    fun ordered(): List<CarriedBroadcast> {
        val now = System.currentTimeMillis()
        return carried.values
            .filter {
                val expiresAt = try {
                    java.time.Instant.parse(it.broadcast.expiresAt).toEpochMilli()
                } catch (e: Exception) {
                    now
                }
                expiresAt > now
            }
            .sortedBy { it.receivedAtMs }
    }

    fun prune(nowMs: Long) {
        carried.values.removeIf {
            val expiresAt = try {
                java.time.Instant.parse(it.broadcast.expiresAt).toEpochMilli()
            } catch (e: Exception) {
                nowMs
            }
            expiresAt <= nowMs
        }
    }
}
