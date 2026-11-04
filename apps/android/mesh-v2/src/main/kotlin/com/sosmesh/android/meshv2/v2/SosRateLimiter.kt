package com.sosmesh.android.meshv2.v2

/**
 * §8.1 client limit: ≤ 1 new SOS per 60 s, ≤ 10 per rolling hour. Never refuses:
 * REPLACE the previous own message if it has not left the device, otherwise QUEUE until [releaseAtMs].
 */
class SosRateLimiter(
    private val minIntervalMs: Long = 60_000L,
    private val perHour: Int = 10,
) {
    sealed class Decision {
        data object SendNow : Decision()

        data class ReplacePrevious(val previousMessageId: String) : Decision()

        data class Queue(val releaseAtMs: Long) : Decision()
    }

    private val sentAt = ArrayDeque<Long>()
    private val lock = Any()

    fun decide(
        nowMs: Long,
        previousMessageId: String?,
        previousLeftDevice: Boolean,
    ): Decision =
        synchronized(lock) {
            while (sentAt.isNotEmpty() && nowMs - sentAt.first() >= 3_600_000L) sentAt.removeFirst()
            val last = sentAt.lastOrNull()
            val intervalOpen = last == null || nowMs - last >= minIntervalMs
            val hourOpen = sentAt.size < perHour
            if (intervalOpen && hourOpen) {
                sentAt.addLast(nowMs)
                return Decision.SendNow
            }
            if (previousMessageId != null && !previousLeftDevice) {
                return Decision.ReplacePrevious(previousMessageId)
            }
            val byInterval = (last ?: nowMs) + minIntervalMs
            val byHour = if (hourOpen) nowMs else sentAt.first() + 3_600_000L
            Decision.Queue(maxOf(byInterval, byHour))
        }

    /** Call when a queued message is actually released. */
    fun recordRelease(nowMs: Long) = synchronized(lock) { sentAt.addLast(nowMs) }
}
