package com.sosmesh.android.feature.sos.attachment

/**
 * Represents an attachment queued for upload once the SOS ingest receipt arrives.
 */
data class PendingAttachment(
    val sosId: String,
    val kind: String,
    val filePath: String,
    val mimeType: String,
    val uploadToken: String? = null,
    val baseUrl: String? = null,
)
