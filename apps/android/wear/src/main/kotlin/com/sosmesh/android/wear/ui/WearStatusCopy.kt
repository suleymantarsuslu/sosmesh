package com.sosmesh.android.wear.ui

import androidx.annotation.StringRes
import androidx.compose.ui.graphics.Color
import com.sosmesh.android.core.wear.companion.sync.WearUserFacingPhase
import com.sosmesh.android.wear.R

internal enum class WearStatusTone {
    READY,
    PROGRESS,
    SAVED,
    WARNING,
    ERROR,
    ;

    fun color(): Color =
        when (this) {
            READY -> WearSosPalette.Success
            PROGRESS -> WearSosPalette.Warning
            SAVED -> WearSosPalette.Success
            WARNING -> WearSosPalette.Warning
            ERROR -> WearSosPalette.Error
        }
}

internal data class WearStatusCopy(
    @StringRes val headline: Int,
    @StringRes val detail: Int,
    val tone: WearStatusTone,
)

/** Localized copy per phase; the phase comes from the unchanged data layer. */
internal fun WearUserFacingPhase.toStatusCopy(): WearStatusCopy =
    when (this) {
        WearUserFacingPhase.IDLE,
        WearUserFacingPhase.CONFIRM_REQUIRED,
        ->
            WearStatusCopy(R.string.status_idle_headline, R.string.status_idle_detail, WearStatusTone.READY)
        WearUserFacingPhase.SENDING ->
            WearStatusCopy(R.string.status_sending_headline, R.string.status_sending_detail, WearStatusTone.PROGRESS)
        WearUserFacingPhase.WAITING_PHONE_ACK ->
            WearStatusCopy(
                R.string.status_waiting_ack_headline,
                R.string.status_waiting_ack_detail,
                WearStatusTone.PROGRESS,
            )
        WearUserFacingPhase.PHONE_QUEUED ->
            WearStatusCopy(R.string.status_queued_headline, R.string.status_queued_detail, WearStatusTone.SAVED)
        WearUserFacingPhase.PHONE_UNREACHABLE ->
            WearStatusCopy(R.string.status_sending_headline, R.string.status_sending_detail, WearStatusTone.PROGRESS)
        WearUserFacingPhase.FAILED ->
            WearStatusCopy(R.string.status_failed_headline, R.string.status_failed_detail, WearStatusTone.ERROR)
        WearUserFacingPhase.STALE ->
            WearStatusCopy(R.string.status_stale_headline, R.string.status_stale_detail, WearStatusTone.WARNING)
    }
