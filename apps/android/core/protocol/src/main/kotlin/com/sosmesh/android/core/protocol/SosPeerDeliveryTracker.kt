package com.sosmesh.android.core.protocol

import com.sosmesh.android.core.data.di.OutboxIoScope
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tracks peer delivery for fan-out: marks LOCAL_SAVED → PEER_RECEIVED only after all
 * currently discovered peers have received the message (or the message reaches the server).
 */
@Singleton
class SosPeerDeliveryTracker
    @Inject
    constructor(
        private val outbox: OutboxQueueAdapter,
        private val outboxIoScope: OutboxIoScope,
        private val peerRecordStore: PeerDeliveryRecordStore,
    ) {
        data class ActiveTransfer(
            val sosId: String,
            val digest: String,
            val peerId: String?,
            /** Non-null while an attachment copy (not the SOS itself) is on the wire. */
            val attachmentId: String? = null,
        )

        @Volatile
        var active: ActiveTransfer? = null

        private var completionCallback: ((String, String, String?, Boolean) -> Unit)? = null

        private var attachmentCallback: ((sosId: String, digest: String, attachmentId: String, peerId: String?, success: Boolean) -> Unit)? = null

        fun setAttachmentCallback(callback: (sosId: String, digest: String, attachmentId: String, peerId: String?, success: Boolean) -> Unit) {
            attachmentCallback = callback
        }

        fun setCompletionCallback(callback: (sosId: String, digest: String, peerId: String?, success: Boolean) -> Unit) {
            completionCallback = callback
        }

        fun attachSenderListener(sender: BleTransferSender) {
            sender.setListener(
                object : BleTransferSender.Listener {
                    override fun onCompleted() {
                        val ctx = active ?: return
                        if (ctx.attachmentId != null) {
                            outboxIoScope.launchOutboxWork {
                                attachmentCallback?.invoke(ctx.sosId, ctx.digest, ctx.attachmentId, ctx.peerId, true)
                            }
                            active = null
                            return
                        }
                        outboxIoScope.launchOutboxWork {
                            if (ctx.peerId != null) {
                                peerRecordStore.recordDelivery(ctx.sosId, ctx.peerId)
                            }
                            completionCallback?.invoke(ctx.sosId, ctx.digest, ctx.peerId, true)
                        }
                        active = null
                    }

                    override fun onFailed(
                        code: ErrorCode,
                        message: String,
                    ) {
                        val ctx = active ?: return
                        outboxIoScope.launchOutboxWork {
                            if (ctx.attachmentId != null) {
                                attachmentCallback?.invoke(ctx.sosId, ctx.digest, ctx.attachmentId, ctx.peerId, false)
                            } else {
                                completionCallback?.invoke(ctx.sosId, ctx.digest, ctx.peerId, false)
                            }
                            outbox.setRetryAt(
                                ctx.sosId,
                                ctx.digest,
                                System.currentTimeMillis() + 2_000L,
                                message,
                            )
                        }
                        active = null
                    }
                },
            )
        }

        suspend fun markPeerReceivedIfAllDelivered(
            sosId: String,
            digest: String,
            allDiscoveredPeerIds: Set<String>,
            nowMs: Long,
        ) {
            if (peerRecordStore.hasDeliveredToAll(sosId, allDiscoveredPeerIds)) {
                outbox.updateState(sosId, digest, "PEER_RECEIVED", nowMs, null)
                peerRecordStore.clearMessageRecords(sosId)
            }
        }
    }
