package com.sosmesh.android.feature.relay.uplink

sealed class RelayIngestResult {
    data class Success(val uploadToken: String?) : RelayIngestResult()

    data object NoNetwork : RelayIngestResult()

    data class RateLimited(val retryAfterMs: Long) : RelayIngestResult()

    data class HttpError(val code: Int, val message: String) : RelayIngestResult()

    /** Same message_id already bound to a different packet hash (HTTP 409). */
    data object MessageIdConflict : RelayIngestResult()

    /** Receipt missing or Ed25519 verification failed — outbox must stay unchanged. */
    data object InvalidReceipt : RelayIngestResult()
}

data class ServerAcceptedReceipt(
    val ackType: String,
    val messageId: String,
    val packetHash: String,
    val timestamp: String,
    val signature: String,
)

/**
 * Uplink port for POST /v1/ingest with ADIM 18 DTO semantics.
 */
interface RelayIngestUplink {
    fun uploadOutboxEntry(
        sosId: String,
        digest: String,
        encryptedBlobBase64: String,
    ): RelayIngestResult
}
