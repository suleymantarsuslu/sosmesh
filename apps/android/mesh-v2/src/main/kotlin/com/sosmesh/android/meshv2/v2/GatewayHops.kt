package com.sosmesh.android.meshv2.v2

/**
 * §4.1 transitive online state. h=0 gateway (validated HTTPS ≤ 60 s), else 1 + min(h_n) over fresh
 * neighbours (≤ 30 s, h_n ≤ 7, parentKey != selfKey), else 0xFF. Increases are held down to +1 per 15 s.
 */
class GatewayHopsTracker(
    private val gatewayFreshMs: Long = 60_000L,
    private val neighbourFreshMs: Long = 30_000L,
    private val holdDownMs: Long = 15_000L,
) {
    data class Neighbour(
        val peerId: String,
        val h: Int,
        val selfKey: Int?,
        val parentKey: Int?,
        val lastSeenMs: Long,
        val liveLink: Boolean,
        val rssi: Int,
    )

    data class State(val h: Int, val parentKey: Int, val parentPeerId: String?, val confirmedAtMs: Long)

    private val neighbours = HashMap<String, Neighbour>()
    private var lastApiSuccessMs: Long = Long.MIN_VALUE
    private var published = State(MeshV2Wire.H_OFFLINE, 0, null, 0L)
    private var lastIncreaseMs: Long = Long.MIN_VALUE
    private val lock = Any()

    fun onApiReachable(nowMs: Long) = synchronized(lock) { lastApiSuccessMs = nowMs }

    fun onNeighbour(n: Neighbour) = synchronized(lock) { neighbours[n.peerId] = n }

    fun onLinkLost(peerId: String) =
        synchronized(lock) {
            neighbours[peerId]?.let { neighbours[peerId] = it.copy(liveLink = false) }
        }

    fun neighbours(): List<Neighbour> = synchronized(lock) { neighbours.values.toList() }

    fun compute(
        selfKey: Int,
        nowMs: Long,
    ): State =
        synchronized(lock) {
            neighbours.values.removeAll { !it.liveLink && nowMs - it.lastSeenMs > neighbourFreshMs * 4 }
            val raw = rawState(selfKey, nowMs)
            val prev = published
            published =
                when {
                    raw.h == MeshV2Wire.H_OFFLINE || prev.h == MeshV2Wire.H_OFFLINE || raw.h <= prev.h -> raw
                    lastIncreaseMs == Long.MIN_VALUE || nowMs - lastIncreaseMs >= holdDownMs -> {
                        lastIncreaseMs = nowMs
                        raw.copy(h = minOf(raw.h, prev.h + 1))
                    }
                    else -> prev.copy(parentKey = raw.parentKey, parentPeerId = raw.parentPeerId)
                }
            published
        }

    private fun rawState(
        selfKey: Int,
        nowMs: Long,
    ): State {
        if (lastApiSuccessMs != Long.MIN_VALUE && nowMs - lastApiSuccessMs <= gatewayFreshMs) {
            return State(0, 0, null, lastApiSuccessMs)
        }
        val best =
            neighbours.values
                .filter { it.liveLink || nowMs - it.lastSeenMs <= neighbourFreshMs }
                .filter { it.h <= MeshV2Wire.MAX_HOPS - 1 }
                .filter { it.parentKey == null || it.parentKey != selfKey }
                .minWithOrNull(compareBy<Neighbour> { it.h }.thenByDescending { it.rssi })
                ?: return State(MeshV2Wire.H_OFFLINE, 0, null, 0L)
        return State(best.h + 1, best.selfKey ?: 0, best.peerId, best.lastSeenMs)
    }

    /** §4.3: lowest h, then strongest RSSI. Only peers strictly closer than us unless spray is allowed. */
    fun pickForwardPeer(
        selfH: Int,
        nowMs: Long,
        sprayAllowed: Boolean,
    ): Neighbour? =
        synchronized(lock) {
            val fresh = neighbours.values.filter { it.liveLink || nowMs - it.lastSeenMs <= neighbourFreshMs }
            val ordered = fresh.sortedWith(compareBy<Neighbour> { it.h }.thenByDescending { it.rssi })
            ordered.firstOrNull { it.h < selfH } ?: if (sprayAllowed) ordered.firstOrNull() else null
        }
}
