package com.sosmesh.android.core.wear.companion.watch

import com.sosmesh.android.core.model.SosType
import com.sosmesh.android.core.wear.companion.protocol.WearCompanionCodec
import com.sosmesh.android.core.wear.companion.protocol.WearOutboundWireStatus
import com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckWire
import com.sosmesh.android.core.wear.companion.protocol.WearSosCreateWire
import com.sosmesh.android.core.wear.companion.queue.WearOfflineQueue
import com.sosmesh.android.core.wear.companion.queue.WearOfflineQueueStore
import com.sosmesh.android.core.wear.companion.queue.WearOutboundEntry
import com.sosmesh.android.core.wear.companion.sync.WearDisplayState
import com.sosmesh.android.core.wear.companion.sync.WearStateSyncEngine
import com.sosmesh.android.core.wear.companion.transport.WearCompanionTransport
import java.util.UUID

class WearSosCoordinator(
    private val store: WearOfflineQueueStore,
    private val transport: WearCompanionTransport,
) {
    private val queue = WearOfflineQueue(store)
    private var lastAck: WearPhoneAckWire? = null
    private var activeMessageId: String? = null

    fun buildCreateWire(nowMs: Long): WearSosCreateWire =
        WearSosCreateWire(
            messageId = UUID.randomUUID().toString(),
            nonce = UUID.randomUUID().toString(),
            sosType = SosType.DIGER.wireValue,
            personCount = 1,
            note = "",
            language = "tr",
            createdAtMs = nowMs,
        )

    fun submitConfirmed(
        wire: WearSosCreateWire,
        nowMs: Long,
    ): WearOutboundEntry {
        activeMessageId = wire.messageId
        val reachable = transport.isPhoneReachable()
        val entry = queue.enqueueOrGetExisting(wire, nowMs, reachable)
        if (entry.status != WearOutboundWireStatus.PHONE_QUEUED) {
            dispatch(entry, nowMs)
        }
        return store.get(wire.messageId) ?: entry
    }

    fun applyPhoneAck(
        ack: WearPhoneAckWire,
        nowMs: Long,
    ): WearOutboundEntry? {
        lastAck = ack
        activeMessageId = ack.messageId
        return queue.applyPhoneAck(ack.messageId, ack.nonce, ack.status, ack.outboxDigest, nowMs)
    }

    fun retryDue(nowMs: Long) {
        queue.listDueForRetry(nowMs).forEach { dispatch(it, nowMs) }
    }

    fun displayState(nowMs: Long): WearDisplayState {
        val entry = activeMessageId?.let { store.get(it) }
        return WearStateSyncEngine.fromOutbound(
            entry = entry,
            lastAck = lastAck,
            watchConnectedToPhone = transport.isPhoneReachable(),
            nowMs = nowMs,
        )
    }

    fun latestEntry(): WearOutboundEntry? = activeMessageId?.let { store.get(it) }

    private fun dispatch(
        entry: WearOutboundEntry,
        nowMs: Long,
    ) {
        val payload = WearCompanionCodec.encodeCreate(entry.wire)
        if (!transport.isPhoneReachable()) {
            queue.markSendAttemptFailed(entry.messageId, nowMs, "phone_not_reachable")
            return
        }
        transport.sendCreateToPhone(
            payload = payload,
            onSuccess = { },
            onFailure = { error -> queue.markSendAttemptFailed(entry.messageId, nowMs, error) },
        )
    }
}
