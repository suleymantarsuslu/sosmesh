package com.sosmesh.android.core.data.sos

import org.junit.Assert.assertEquals
import org.junit.Test

class LocationFreshnessTest {
    @Test
    fun nullCapture_isUnknown() {
        assertEquals(
            LocationFreshnessTier.UNKNOWN,
            LocationFreshness.tier(capturedAtMs = null, nowMs = 1_000L),
        )
    }

    @Test
    fun recentCapture_isFresh() {
        val now = 1_000_000L
        assertEquals(
            LocationFreshnessTier.FRESH,
            LocationFreshness.tier(capturedAtMs = now - 30_000L, nowMs = now),
        )
    }

    @Test
    fun oldCapture_isStale() {
        val now = 1_000_000L
        assertEquals(
            LocationFreshnessTier.STALE,
            LocationFreshness.tier(capturedAtMs = now - 900_000L, nowMs = now),
        )
    }
}
