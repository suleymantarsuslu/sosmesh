package com.sosmesh.android.meshv2.v2

import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Persistent per-copy mesh metadata for relayed messages (§2.3, §3.1, §4.3). The L2 bytes themselves are persisted in
 * the Room outbox (origin "relay"); this keeps the L1 fields we must carry forward plus the spray peer set.
 * Contains message ids and hashed relay ids only, no PII. Call from a background thread.
 */
class CarryMetaStore(private val file: File?) {
    @Serializable
    data class Meta(
        val receivedHopCount: Int,
        val receivedCopyCount: Int = 1,
        val relayChain: List<String> = emptyList(),
        val originCreatedAtMs: Long,
        val receivedAtMs: Long,
        val forwardedPeers: List<String> = emptyList(),
    ) {
        /** §9: relayInfo.hopCount for our upload = L1 hopCount + 1. */
        val uploadHopCount: Int get() = (receivedHopCount + 1).coerceIn(1, MeshV2Wire.MAX_HOPS)
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = MapSerializer(String.serializer(), Meta.serializer())
    private val map: MutableMap<String, Meta> by lazy { load() }

    @Synchronized
    fun get(messageId: String): Meta? = map[messageId]

    @Synchronized
    fun put(
        messageId: String,
        meta: Meta,
    ) {
        map[messageId] = meta
        save()
    }

    @Synchronized
    fun remove(messageId: String) {
        if (map.remove(messageId) != null) save()
    }

    /**
     * §4.3 spray: record [peerId] for this copy if allowed. Toward a closer peer always; otherwise at most
     * [MeshV2Node.SPRAY_PEER_LIMIT] distinct peers. Never the same peer twice.
     */
    @Synchronized
    fun claimPeer(
        messageId: String,
        peerId: String,
        peerCloserToGateway: Boolean,
    ): Boolean {
        val meta = map[messageId] ?: return false
        if (peerId in meta.forwardedPeers) return false
        if (!peerCloserToGateway && meta.forwardedPeers.size >= MeshV2Node.SPRAY_PEER_LIMIT) return false
        map[messageId] = meta.copy(forwardedPeers = meta.forwardedPeers + peerId)
        save()
        return true
    }

    @Synchronized
    fun canForwardTo(
        messageId: String,
        peerId: String,
        peerCloserToGateway: Boolean,
    ): Boolean {
        val meta = map[messageId] ?: return false
        if (peerId in meta.forwardedPeers) return false
        return peerCloserToGateway || meta.forwardedPeers.size < MeshV2Node.SPRAY_PEER_LIMIT
    }

    @Synchronized
    fun prune(nowMs: Long) {
        val before = map.size
        map.entries.removeAll { nowMs > it.value.receivedAtMs + RETENTION_MS }
        if (map.size != before) save()
    }

    private fun load(): MutableMap<String, Meta> =
        try {
            file?.takeIf { it.exists() }?.readText()?.let { json.decodeFromString(serializer, it).toMutableMap() } ?: mutableMapOf()
        } catch (_: Exception) {
            mutableMapOf()
        }

    private fun save() {
        val target = file ?: return
        try {
            val tmp = File(target.parentFile, target.name + ".tmp")
            tmp.writeText(json.encodeToString(serializer, map))
            tmp.renameTo(target)
        } catch (_: Exception) {
            // Best effort; metadata loss only degrades spray accounting / hop reporting.
        }
    }

    companion object {
        const val RETENTION_MS = 72L * 3_600_000L
    }
}
