package com.sosmesh.android.core.ble

data class DiscoveredPeer(
    val ephemeralIdHex: String,
    val role: PeerRole,
    val lastSeenMillis: Long,
    val discoveryCount: Int,
)

class PeerRegistry(
    private val ttlMillis: Long = 120_000L,
    private val clock: Clock = SystemClock,
) {
    private val peers = linkedMapOf<String, DiscoveredPeer>()
    private val reconnectAttempts = mutableMapOf<String, Int>()

    fun recordDiscovery(
        manufacturerPayload: ByteArray?,
        role: PeerRole,
    ): DiscoveredPeer? {
        val idHex = payloadToEphemeralHex(manufacturerPayload) ?: return null
        val now = clock.currentTimeMillis()
        val existing = peers[idHex]
        val updated =
            if (existing == null) {
                DiscoveredPeer(idHex, role, now, 1)
            } else {
                existing.copy(
                    lastSeenMillis = now,
                    discoveryCount = existing.discoveryCount + 1,
                    role = mergeRole(existing.role, role),
                )
            }
        peers[idHex] = updated
        pruneExpired(now)
        return updated
    }

    /** Connectable peers by BLE address (Android and iOS), with mesh-v2 h and RSSI. */
    data class AddressPeer(val address: String, val h: Int, val rssi: Int, val lastSeenMillis: Long)

    private val addressPeers = linkedMapOf<String, AddressPeer>()

    @Synchronized
    fun recordSighting(
        address: String,
        rssi: Int,
        h: Int,
    ): AddressPeer {
        val now = clock.currentTimeMillis()
        val peer = AddressPeer(address, h, rssi, now)
        addressPeers[address] = peer
        addressPeers.entries.removeIf { it.value.lastSeenMillis < now - ttlMillis }
        return peer
    }

    /** mesh-v2 §4.3: lowest h, then strongest RSSI, then least recently attempted. */
    @Synchronized
    fun bestAddressPeer(exclude: Set<String> = emptySet()): AddressPeer? {
        val now = clock.currentTimeMillis()
        addressPeers.entries.removeIf { it.value.lastSeenMillis < now - ttlMillis }
        return addressPeers.values
            .filter { it.address !in exclude }
            .sortedWith(compareBy<AddressPeer> { it.h }.thenByDescending { it.rssi }.thenBy { reconnectAttempts[it.address] ?: 0 })
            .firstOrNull()
    }

    @Synchronized
    fun addressPeers(): List<AddressPeer> = addressPeers.values.toList()

    fun activePeers(): List<DiscoveredPeer> {
        pruneExpired(clock.currentTimeMillis())
        return peers.values.toList()
    }

    fun activePeerCount(): Int = maxOf(activePeers().size, synchronized(this) { addressPeers.size })

    fun pruneExpired(now: Long = clock.currentTimeMillis()) {
        val cutoff = now - ttlMillis
        peers.entries.removeIf { it.value.lastSeenMillis < cutoff }
    }

    fun registerReconnectAttempt(peerId: String): Long {
        val attempt = (reconnectAttempts[peerId] ?: 0) + 1
        reconnectAttempts[peerId] = attempt
        return reconnectBackoffMillis(attempt)
    }

    fun clearReconnectAttempts(peerId: String) {
        reconnectAttempts.remove(peerId)
    }

    fun reconnectBackoffMillis(attempt: Int): Long {
        val capped = attempt.coerceAtMost(5)
        return (1L shl (capped - 1)) * 1_000L
    }

    private fun mergeRole(
        current: PeerRole,
        incoming: PeerRole,
    ): PeerRole {
        if (current == incoming) return current
        if (current == PeerRole.BOTH || incoming == PeerRole.BOTH) return PeerRole.BOTH
        return PeerRole.BOTH
    }

    private fun payloadToEphemeralHex(payload: ByteArray?): String? {
        if (payload == null || payload.size < 1 + BleMeshConstants.OPAQUE_ID_BYTES) {
            return null
        }
        val opaque = payload.copyOfRange(1, 1 + BleMeshConstants.OPAQUE_ID_BYTES)
        return opaque.joinToString("") { byte -> "%02x".format(byte) }
    }
}
