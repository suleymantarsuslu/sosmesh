package com.sosmesh.android.core.wear.companion.sync

import com.sosmesh.android.core.wear.companion.protocol.WearOutboundWireStatus
import com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckWire
import com.sosmesh.android.core.wear.companion.queue.WearOutboundEntry

enum class WearUserFacingPhase {
    IDLE,
    CONFIRM_REQUIRED,
    SENDING,
    PHONE_UNREACHABLE,
    WAITING_PHONE_ACK,
    PHONE_QUEUED,
    FAILED,
    STALE,
}

data class WearDisplayState(
    val phase: WearUserFacingPhase,
    val headlineTr: String,
    val detailTr: String,
    val showsFalseSuccess: Boolean,
    val messageId: String? = null,
)

object WearStateSyncEngine {
    private const val STALE_AFTER_MS = 120_000L

    fun fromOutbound(
        entry: WearOutboundEntry?,
        lastAck: WearPhoneAckWire?,
        watchConnectedToPhone: Boolean,
        nowMs: Long,
    ): WearDisplayState {
        if (entry == null) {
            return idle()
        }
        val ackFresh =
            lastAck != null &&
                lastAck.messageId == entry.messageId &&
                lastAck.nonce == entry.nonce &&
                (nowMs - lastAck.phoneNowMs) <= STALE_AFTER_MS

        return when (entry.status) {
            WearOutboundWireStatus.PHONE_QUEUED ->
                WearDisplayState(
                    phase = WearUserFacingPhase.PHONE_QUEUED,
                    headlineTr = "Telefona kaydedildi",
                    detailTr = "Telefon kuyruğuna alındı; sunucuya ulaştı denmez.",
                    showsFalseSuccess = false,
                    messageId = entry.messageId,
                )
            WearOutboundWireStatus.AWAITING_PHONE ->
                WearDisplayState(
                    phase = WearUserFacingPhase.WAITING_PHONE_ACK,
                    headlineTr = "Gönderiliyor",
                    detailTr = "Mesh üzerinden iletiliyor.",
                    showsFalseSuccess = false,
                    messageId = entry.messageId,
                )
            WearOutboundWireStatus.PHONE_UNREACHABLE ->
                WearDisplayState(
                    phase = WearUserFacingPhase.SENDING,
                    headlineTr = "Gönderiliyor",
                    detailTr = "Mesh üzerinden iletiliyor.",
                    showsFalseSuccess = false,
                    messageId = entry.messageId,
                )
            WearOutboundWireStatus.FAILED ->
                WearDisplayState(
                    phase = WearUserFacingPhase.FAILED,
                    headlineTr = "Telefona iletilemedi",
                    detailTr = entry.lastError ?: "Tekrar denenecek.",
                    showsFalseSuccess = false,
                    messageId = entry.messageId,
                )
            WearOutboundWireStatus.LOCAL_PENDING ->
                WearDisplayState(
                    phase = WearUserFacingPhase.SENDING,
                    headlineTr = "Hazırlanıyor",
                    detailTr = "SOS hazırlanıyor.",
                    showsFalseSuccess = false,
                    messageId = entry.messageId,
                )
            else ->
                if (ackFresh && entry.status != WearOutboundWireStatus.PHONE_QUEUED) {
                    stale(entry.messageId)
                } else {
                    idle()
                }
        }
    }

    fun idle(): WearDisplayState =
        WearDisplayState(
            phase = WearUserFacingPhase.IDLE,
            headlineTr = "SOS",
            detailTr = "Acil durumda iki adımda onaylayın.",
            showsFalseSuccess = false,
        )

    private fun unreachable(messageId: String): WearDisplayState =
        WearDisplayState(
            phase = WearUserFacingPhase.PHONE_UNREACHABLE,
            headlineTr = "Telefona ulaşılamıyor",
            detailTr = "SOS saatte bekletiliyor; gönderildi denmez.",
            showsFalseSuccess = false,
            messageId = messageId,
        )

    private fun stale(messageId: String): WearDisplayState =
        WearDisplayState(
            phase = WearUserFacingPhase.STALE,
            headlineTr = "Durum güncel değil",
            detailTr = "Telefon bağlantısını kontrol edin.",
            showsFalseSuccess = false,
            messageId = messageId,
        )
}
