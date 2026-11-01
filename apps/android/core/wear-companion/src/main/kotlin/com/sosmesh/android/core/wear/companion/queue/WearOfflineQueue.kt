package com.sosmesh.android.core.wear.companion.queue

import com.sosmesh.android.core.wear.companion.protocol.WearOutboundWireStatus
import com.sosmesh.android.core.wear.companion.protocol.WearSosCreateWire

data class WearOutboundEntry(
    val messageId: String,
    val nonce: String,
    val wire: WearSosCreateWire,
    val status: String,
    val attemptCount: Int,
    val nextRetryAtMs: Long,
    val lastError: String?,
    val updatedAtMs: Long,
    val phoneAckDigest: String? = null,
)

interface WearOfflineQueueStore {
    fun get(messageId: String): WearOutboundEntry?

    fun listAll(): List<WearOutboundEntry>

    fun upsert(entry: WearOutboundEntry)

    fun remove(messageId: String)
}

class InMemoryWearOfflineQueueStore : WearOfflineQueueStore {
    private val entries = linkedMapOf<String, WearOutboundEntry>()

    override fun get(messageId: String): WearOutboundEntry? = entries[messageId]

    override fun listAll(): List<WearOutboundEntry> = entries.values.toList()

    override fun upsert(entry: WearOutboundEntry) {
        entries[entry.messageId] = entry
    }

    override fun remove(messageId: String) {
        entries.remove(messageId)
    }
}

object WearRetryPolicy {
    private val backoffMs = longArrayOf(5_000L, 15_000L, 60_000L, 300_000L)

    fun nextRetryAtMs(
        attemptCount: Int,
        nowMs: Long,
    ): Long {
        val index = attemptCount.coerceAtMost(backoffMs.lastIndex)
        return nowMs + backoffMs[index]
    }

    fun shouldRetry(
        entry: WearOutboundEntry,
        nowMs: Long,
    ): Boolean = entry.status != WearOutboundWireStatus.PHONE_QUEUED && nowMs >= entry.nextRetryAtMs
}

class WearOfflineQueue(
    private val store: WearOfflineQueueStore,
) {
    fun enqueueOrGetExisting(
        wire: WearSosCreateWire,
        nowMs: Long,
        phoneReachable: Boolean,
    ): WearOutboundEntry {
        store.get(wire.messageId)?.let { return it }
        val initialStatus =
            if (phoneReachable) {
                WearOutboundWireStatus.AWAITING_PHONE
            } else {
                WearOutboundWireStatus.PHONE_UNREACHABLE
            }
        val entry =
            WearOutboundEntry(
                messageId = wire.messageId,
                nonce = wire.nonce,
                wire = wire,
                status = initialStatus,
                attemptCount = 0,
                nextRetryAtMs = nowMs,
                lastError = if (phoneReachable) null else "phone_not_reachable",
                updatedAtMs = nowMs,
            )
        store.upsert(entry)
        return entry
    }

    fun markSendAttemptFailed(
        messageId: String,
        nowMs: Long,
        error: String,
    ): WearOutboundEntry? {
        val existing = store.get(messageId) ?: return null
        val attempts = existing.attemptCount + 1
        val updated =
            existing.copy(
                status = WearOutboundWireStatus.PHONE_UNREACHABLE,
                attemptCount = attempts,
                nextRetryAtMs = WearRetryPolicy.nextRetryAtMs(attempts, nowMs),
                lastError = error,
                updatedAtMs = nowMs,
            )
        store.upsert(updated)
        return updated
    }

    fun applyPhoneAck(
        messageId: String,
        nonce: String,
        ackStatus: String,
        outboxDigest: String?,
        nowMs: Long,
    ): WearOutboundEntry? {
        val existing = store.get(messageId) ?: return null
        if (existing.nonce != nonce) {
            return existing
        }
        val updated =
            when (ackStatus) {
                com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckStatus.QUEUED,
                com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckStatus.DUPLICATE,
                ->
                    existing.copy(
                        status = WearOutboundWireStatus.PHONE_QUEUED,
                        phoneAckDigest = outboxDigest,
                        lastError = null,
                        updatedAtMs = nowMs,
                    )
                else ->
                    existing.copy(
                        status = WearOutboundWireStatus.FAILED,
                        lastError = ackStatus,
                        updatedAtMs = nowMs,
                    )
            }
        store.upsert(updated)
        return updated
    }

    fun listDueForRetry(nowMs: Long): List<WearOutboundEntry> = store.listAll().filter { WearRetryPolicy.shouldRetry(it, nowMs) }
}
