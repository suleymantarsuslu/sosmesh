package com.sosmesh.android.core.protocol

/** One shrunk + encrypted attachment copy ready to travel as a BLE transfer payload ([BleAttachmentWire]). */
class BleAttachmentBlob(
    val attachmentId: String,
    val digest: String,
    val bytes: ByteArray,
)

/**
 * Supplies the sender's own attachments for the BLE hop. The orchestrator asks for the next copy a peer has not
 * received yet after that peer got the SOS itself. Implementations shrink + encrypt lazily and bound retries per peer.
 */
interface BleAttachmentSource {
    suspend fun nextFor(
        sosId: String,
        peerId: String,
    ): BleAttachmentBlob?

    suspend fun hasPending(
        sosId: String,
        peerId: String,
    ): Boolean

    suspend fun markDelivered(
        sosId: String,
        attachmentId: String,
        peerId: String,
    )

    suspend fun markFailed(
        sosId: String,
        attachmentId: String,
        peerId: String,
    )
}
