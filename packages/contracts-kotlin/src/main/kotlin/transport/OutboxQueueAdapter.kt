package com.sosmesh.contracts.transport

data class OutboxEntryMeta(
    val sosId: String,
    val digest: String,
    val origin: String,
    val encryptedBlobBase64: String,
    val state: String,
    val retryAtMs: Long,
    val expiresAtMs: Long,
    val lastError: String?,
    val createdAtMs: Long,
    val updatedAtMs: Long,
)

data class EnqueueInput(
    val sosId: String,
    val digest: String,
    val origin: String,
    val encryptedBlobBase64: String,
    val retentionMs: Long? = null,
)

/**
 * Room-portable contract; JVM implementation uses JDBC SQLite (NOT_TESTED on Android Room).
 */
interface OutboxQueueAdapter {
    suspend fun enqueue(
        input: EnqueueInput,
        nowMs: Long,
    ): OutboxEntryMeta

    suspend fun getByKey(
        sosId: String,
        digest: String,
    ): OutboxEntryMeta?

    suspend fun listAll(): List<OutboxEntryMeta>

    /** Deletes one row (mesh-v2: purge a relayed copy after a verified tombstone, or a replaced unsent own SOS). */
    suspend fun deleteEntry(
        sosId: String,
        digest: String,
    ): Boolean = false

    suspend fun updateState(
        sosId: String,
        digest: String,
        state: String,
        nowMs: Long,
        lastError: String? = null,
    ): OutboxEntryMeta?

    suspend fun setRetryAt(
        sosId: String,
        digest: String,
        retryAtMs: Long,
        lastError: String?,
    )

    suspend fun setUploadRetryAt(
        sosId: String,
        digest: String,
        retryAtMs: Long,
        lastError: String?,
    )

    suspend fun clearUploadRetry(
        sosId: String,
        digest: String,
    )

    suspend fun countDueForSend(
        nowMs: Long,
        paused: Boolean,
    ): Int

    suspend fun purgeExpired(nowMs: Long): Int

    fun close()
}
