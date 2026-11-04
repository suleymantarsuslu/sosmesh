package com.sosmesh.android.feature.relay.uplink

/**
 * Test-only fake uplink (not wired in production DI).
 */
class FakeRelayIngestUplink : RelayIngestUplink {
    @Volatile
    var nextResult: RelayIngestResult = RelayIngestResult.HttpError(503, "ingest_not_wired")

    @Volatile
    var uploadCallCount: Int = 0
    
    @Volatile
    var onUpload: ((sosId: String, digest: String, blob: String, hopCount: Int) -> Unit)? = null

    override fun uploadOutboxEntry(
        sosId: String,
        digest: String,
        encryptedBlobBase64: String,
        hopCount: Int,
    ): RelayIngestResult {
        uploadCallCount++
        onUpload?.invoke(sosId, digest, encryptedBlobBase64, hopCount)
        return nextResult
    }

    fun reset() {
        nextResult = RelayIngestResult.HttpError(503, "ingest_not_wired")
        uploadCallCount = 0
        onUpload = null
    }
}
