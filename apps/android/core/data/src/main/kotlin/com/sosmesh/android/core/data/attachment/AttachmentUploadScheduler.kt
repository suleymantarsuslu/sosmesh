package com.sosmesh.android.core.data.attachment

/**
 * Contract for scheduling attachment uploads when an ingest receipt with uploadToken is received.
 * Implemented by feature-sos and injected into feature-relay.
 */
interface AttachmentUploadScheduler {
    /**
     * Schedule upload of any pending attachments for the given SOS message.
     *
     * @param sosId The SOS message ID
     * @param uploadToken The upload token from the ingest receipt
     * @param baseUrl The API base URL for uploads
     */
    fun scheduleUploadsForMessage(
        sosId: String,
        uploadToken: String,
        baseUrl: String,
    )
}
