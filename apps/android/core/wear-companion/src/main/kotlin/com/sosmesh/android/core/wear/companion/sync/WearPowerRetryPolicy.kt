package com.sosmesh.android.core.wear.companion.sync

/**
 * Documents retry/backoff expectations when the watch is in battery saver.
 * Does not bypass user-visible «telefona ulaşılamıyor» semantics.
 */
object WearPowerRetryPolicy {
    private const val BATTERY_SAVER_BACKOFF_MULTIPLIER = 2

    fun effectiveRetryDelayMs(
        baseDelayMs: Long,
        batterySaverEnabled: Boolean,
    ): Long =
        if (batterySaverEnabled) {
            baseDelayMs * BATTERY_SAVER_BACKOFF_MULTIPLIER
        } else {
            baseDelayMs
        }

    fun batterySaverDetailTr(batterySaverEnabled: Boolean): String? =
        if (batterySaverEnabled) {
            "Pil tasarrufu açık; yeniden deneme daha seyrek."
        } else {
            null
        }
}
