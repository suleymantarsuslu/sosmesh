package com.sosmesh.android.feature.relay.uplink

sealed class RelayIngestResult {
    data object Success : RelayIngestResult()

    data object NoNetwork : RelayIngestResult()

    data class RateLimited(val retryAfterMs: Long) : RelayIngestResult()

    data class HttpError(val code: Int, val message: String) : RelayIngestResult()
}

/**
 * Uplink port for POST /v1/ingest. Production HTTP client is implemented in ADIM 18.
 */
interface RelayIngestUplink {
    fun uploadEncryptedBlob(encryptedBlobBase64: String): RelayIngestResult
}
