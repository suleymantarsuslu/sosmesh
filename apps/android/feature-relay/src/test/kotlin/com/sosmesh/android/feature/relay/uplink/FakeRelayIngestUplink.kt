package com.sosmesh.android.feature.relay.uplink

/**
 * Test-only fake uplink (not wired in production DI).
 */
class FakeRelayIngestUplink : RelayIngestUplink {
    @Volatile
    var nextResult: RelayIngestResult = RelayIngestResult.HttpError(503, "ingest_not_wired")

    @Volatile
    var uploadCallCount: Int = 0

    override fun uploadOutboxEntry(
        sosId: String,
        digest: String,
        encryptedBlobBase64: String,
    ): RelayIngestResult {
        uploadCallCount++
        return nextResult
    }

    fun reset() {
        nextResult = RelayIngestResult.HttpError(503, "ingest_not_wired")
        uploadCallCount = 0
    }
}
