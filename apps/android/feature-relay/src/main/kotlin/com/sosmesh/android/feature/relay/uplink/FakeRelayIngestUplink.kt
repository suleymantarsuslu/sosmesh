package com.sosmesh.android.feature.relay.uplink

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Testable fake uplink. Production binding delegates here until ADIM 18 HTTP client exists.
 */
@Singleton
class FakeRelayIngestUplink
    @Inject
    constructor() : RelayIngestUplink {
        @Volatile
        var nextResult: RelayIngestResult = RelayIngestResult.HttpError(503, "ingest_not_wired")

        @Volatile
        var uploadCallCount: Int = 0

        override fun uploadEncryptedBlob(encryptedBlobBase64: String): RelayIngestResult {
            uploadCallCount++
            return nextResult
        }

        fun reset() {
            nextResult = RelayIngestResult.HttpError(503, "ingest_not_wired")
            uploadCallCount = 0
        }
    }

/**
 * Keeps the real HTTP client behind [RelayIngestUplink]; reads URL from config for ADIM 18.
 */
@Singleton
class DeferredRelayIngestUplink
    @Inject
    constructor(
        private val config: RelayIngestConfig,
        private val fake: FakeRelayIngestUplink,
    ) : RelayIngestUplink {
        override fun uploadEncryptedBlob(encryptedBlobBase64: String): RelayIngestResult {
            // URL from config is validated for wiring; HTTP stack added in ADIM 18.
            if (config.ingestUrl.isBlank()) {
                return RelayIngestResult.HttpError(500, "missing_ingest_url")
            }
            return fake.uploadEncryptedBlob(encryptedBlobBase64)
        }
    }
