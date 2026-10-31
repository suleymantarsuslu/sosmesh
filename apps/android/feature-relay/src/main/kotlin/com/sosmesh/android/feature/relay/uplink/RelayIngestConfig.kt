package com.sosmesh.android.feature.relay.uplink

/**
 * Ingest endpoint configuration. Real HTTP wiring lands in ADIM 18; URL is reserved here.
 */
data class RelayIngestConfig(
    val ingestUrl: String,
) {
    companion object {
        const val DEFAULT_INGEST_PATH = "/v1/ingest"

        fun defaultBaseUrl(): String = "https://api.sosmesh.local"

        fun default(): RelayIngestConfig =
            RelayIngestConfig(
                ingestUrl = defaultBaseUrl() + DEFAULT_INGEST_PATH,
            )
    }
}
