package com.sosmesh.android.feature.relay.uplink

/**
 * Ingest endpoint configuration (URL + receipt verification key).
 * Production receipt public key distribution requires human approval (see ADIM 19 EKSİKLER).
 */
data class RelayIngestConfig(
    val ingestUrl: String,
    val receiptVerifyPublicKeySpkiBase64: String,
    val relayIdHex: String,
    val hopCount: Int = 1,
    val ttlSeconds: Int = 86_400,
    val requireHttps: Boolean = true,
) {
    companion object {
        const val DEFAULT_INGEST_PATH = "/v1/ingest"

        fun defaultBaseUrl(): String = "https://api.sosmesh.local"

        const val PROD_RECEIPT_PUBLIC_KEY =
            "MCowBQYDK2VwAyEAJgWsM1ZMJK9D9uPkDS/08DL/sOHrBlcCS/ETcKQ2OEs="

        const val PROD_RECEIPT_PUBLIC_KEY_PLACEHOLDER = ""

        fun default(relayIdHex: String): RelayIngestConfig =
            RelayIngestConfig(
                ingestUrl = defaultBaseUrl() + DEFAULT_INGEST_PATH,
                receiptVerifyPublicKeySpkiBase64 = PROD_RECEIPT_PUBLIC_KEY_PLACEHOLDER,
                relayIdHex = relayIdHex,
            )
    }
}
