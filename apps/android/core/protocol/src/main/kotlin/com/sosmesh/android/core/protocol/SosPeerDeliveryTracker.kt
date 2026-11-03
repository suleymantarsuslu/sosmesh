package com.sosmesh.android.core.protocol

import com.sosmesh.android.core.data.di.OutboxIoScope
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Marks LOCAL_SAVED → PEER_RECEIVED only after sender-side chunk ACKs complete (verified mesh ack).
 */
@Singleton
class SosPeerDeliveryTracker
    @Inject
    constructor(
        private val outbox: OutboxQueueAdapter,
        private val outboxIoScope: OutboxIoScope,
    ) {
        data class ActiveTransfer(
            val sosId: String,
            val digest: String,
        )

        @Volatile
        var active: ActiveTransfer? = null

        fun attachSenderListener(sender: BleTransferSender) {
            sender.setListener(
                object : BleTransferSender.Listener {
                    override fun onCompleted() {
                        val ctx = active ?: return
                        outboxIoScope.launchOutboxWork {
                            outbox.updateState(ctx.sosId, ctx.digest, "PEER_RECEIVED", System.currentTimeMillis(), null)
                        }
                        active = null
                    }

                    override fun onFailed(
                        code: ErrorCode,
                        message: String,
                    ) {
                        val ctx = active ?: return
                        outboxIoScope.launchOutboxWork {
                            outbox.setRetryAt(
                                ctx.sosId,
                                ctx.digest,
                                System.currentTimeMillis() + 5_000L,
                                message,
                            )
                        }
                        active = null
                    }
                },
            )
        }
    }
