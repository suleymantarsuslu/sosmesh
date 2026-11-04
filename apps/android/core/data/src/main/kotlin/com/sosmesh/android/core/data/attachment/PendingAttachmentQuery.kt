package com.sosmesh.android.core.data.attachment

/**
 * Port interface for checking pending attachments without upload tokens.
 * Implemented by feature-sos and injected into feature-relay.
 */
interface PendingAttachmentQuery {
    /**
     * Check if a SOS message has pending attachments without an upload token.
     *
     * @param sosId The SOS message ID
     * @return true if there are pending attachments without tokens
     */
    fun hasPendingAttachmentsWithoutToken(sosId: String): Boolean
}
