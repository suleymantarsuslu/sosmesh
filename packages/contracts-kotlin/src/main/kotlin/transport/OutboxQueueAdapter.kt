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
    val updatedAtMs: Long
)

data class EnqueueInput(
    val sosId: String,
    val digest: String,
    val origin: String,
    val encryptedBlobBase64: String,
    val retentionMs: Long? = null
)

/**
 * Room-portable contract; JVM implementation uses JDBC SQLite (NOT_TESTED on Android Room).
 */
interface OutboxQueueAdapter {
    fun enqueue(input: EnqueueInput, nowMs: Long): OutboxEntryMeta
    fun getByKey(sosId: String, digest: String): OutboxEntryMeta?
    fun listAll(): List<OutboxEntryMeta>
    fun updateState(
        sosId: String,
        digest: String,
        state: String,
        nowMs: Long,
        lastError: String? = null
    ): OutboxEntryMeta?
    fun setRetryAt(sosId: String, digest: String, retryAtMs: Long, lastError: String?): Unit
    fun countDueForSend(nowMs: Long, paused: Boolean): Int
    fun purgeExpired(nowMs: Long): Int
    fun close()
}
