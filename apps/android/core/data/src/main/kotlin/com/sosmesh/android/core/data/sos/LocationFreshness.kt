package com.sosmesh.android.core.data.sos

enum class LocationFreshnessTier {
    FRESH,
    AGING,
    STALE,
    UNKNOWN,
}

object LocationFreshness {
    const val FRESH_WINDOW_MS: Long = 120_000L
    const val STALE_AFTER_MS: Long = 600_000L

    fun tier(
        capturedAtMs: Long?,
        nowMs: Long,
        freshWindowMs: Long = FRESH_WINDOW_MS,
        staleAfterMs: Long = STALE_AFTER_MS,
    ): LocationFreshnessTier {
        if (capturedAtMs == null) {
            return LocationFreshnessTier.UNKNOWN
        }
        val ageMs = (nowMs - capturedAtMs).coerceAtLeast(0L)
        return when {
            ageMs <= freshWindowMs -> LocationFreshnessTier.FRESH
            ageMs <= staleAfterMs -> LocationFreshnessTier.AGING
            else -> LocationFreshnessTier.STALE
        }
    }
}
