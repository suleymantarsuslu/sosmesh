package com.sosmesh.android.core.protocol

import com.sosmesh.android.core.ble.MeshV2Hooks

/** Outcome of the mesh-v2 pre-transfer handshake with the connected peer (§5.2). */
sealed class MeshV2Preflight {
    /** Peer is v1 (no FFF4) or v2 is not installed: send as before. */
    data object V1Peer : MeshV2Preflight()

    /** A TombstoneBatchV2 transfer was started; send SOS on the next cycle. */
    data object TombstoneBatchSent : MeshV2Preflight()

    /** Per-messageId decision; only WANT may be transferred. */
    data class Statuses(val byMessageId: Map<String, Int>) : MeshV2Preflight() {
        fun wants(id: String): Boolean = (byMessageId[id] ?: STATUS_WANT) == STATUS_WANT
    }

    companion object {
        const val STATUS_WANT = 0
        const val STATUS_HAVE = 1
        const val STATUS_DELIVERED = 2
    }
}

/**
 * Central side of mesh v2: push tombstones first, OFFER, pull tombstones for DELIVERED keys.
 * Never logs ids or payloads.
 */
object MeshV2CentralSession {
    private const val OFFER_REPLY: Byte = 0x31
    private const val TOMBSTONE: Byte = 0x34
    private const val OFFER_WINDOW_MS = 2_000L
    private const val TOMBSTONE_WINDOW_MS = 1_500L

    suspend fun preflight(
        engine: BleTransferEnginePort,
        peerId: String?,
        messageIds: List<String>,
        nowMs: Long,
    ): MeshV2Preflight {
        val hooks = MeshV2Hooks.hooks ?: return MeshV2Preflight.V1Peer
        val ids = messageIds.distinct().take(8)
        if (ids.isEmpty()) return MeshV2Preflight.Statuses(emptyMap())
        val replies =
            engine.meshV2Exchange(hooks.offerFrame(ids), OFFER_REPLY, OFFER_WINDOW_MS, 1)
                ?: return MeshV2Preflight.V1Peer
        // §5.2: no answer within 2 s ⇒ treat all as WANT.
        val statuses = replies.firstOrNull()?.let { hooks.parseOfferReply(it) }?.takeIf { it.size == ids.size }
        val map = ids.mapIndexed { i, id -> id to (statuses?.get(i) ?: MeshV2Preflight.STATUS_WANT) }.toMap()
        val delivered = map.filterValues { it == MeshV2Preflight.STATUS_DELIVERED }.keys.toList()
        if (delivered.isNotEmpty()) {
            val frames =
                engine.meshV2Exchange(hooks.tombstoneRequestFrame(delivered), TOMBSTONE, TOMBSTONE_WINDOW_MS, delivered.size)
            if (!frames.isNullOrEmpty()) hooks.onTombstoneFrames(frames, nowMs)
        }
        // §5.2: push our tombstones before any SOS transfer.
        val batch = peerId?.let { hooks.takeTombstoneBatchFor(it, nowMs) }
        if (batch != null && engine.senderState() == TransferState.IDLE) {
            engine.sendOpaqueForward(batch)
            return MeshV2Preflight.TombstoneBatchSent
        }
        return MeshV2Preflight.Statuses(map)
    }
}
