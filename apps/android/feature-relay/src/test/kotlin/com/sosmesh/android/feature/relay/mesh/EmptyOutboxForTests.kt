package com.sosmesh.android.feature.relay.mesh

import com.sosmesh.contracts.transport.EnqueueInput
import com.sosmesh.contracts.transport.OutboxEntryMeta
import com.sosmesh.contracts.transport.OutboxQueueAdapter

/** Read-only outbox fake for mesh-v2 forward tests. */
open class FakeListOutbox(private val rows: List<OutboxEntryMeta> = emptyList()) : OutboxQueueAdapter {
    override suspend fun enqueue(
        input: EnqueueInput,
        nowMs: Long,
    ): OutboxEntryMeta = error("unused")

    override suspend fun getByKey(
        sosId: String,
        digest: String,
    ): OutboxEntryMeta? = null

    override suspend fun listAll(): List<OutboxEntryMeta> = rows

    override suspend fun updateState(
        sosId: String,
        digest: String,
        state: String,
        nowMs: Long,
        lastError: String?,
    ): OutboxEntryMeta? = null

    override suspend fun setRetryAt(
        sosId: String,
        digest: String,
        retryAtMs: Long,
        lastError: String?,
    ) = Unit

    override suspend fun setUploadRetryAt(
        sosId: String,
        digest: String,
        retryAtMs: Long,
        lastError: String?,
    ) = Unit

    override suspend fun clearUploadRetry(
        sosId: String,
        digest: String,
    ) = Unit

    override suspend fun countDueForSend(
        nowMs: Long,
        paused: Boolean,
    ): Int = 0

    override suspend fun purgeExpired(nowMs: Long): Int = 0

    override fun close() = Unit
}

/** Outbox with no rows: the mesh-v2 forward cycle stays Idle. */
val EmptyOutboxForTests = FakeListOutbox()
