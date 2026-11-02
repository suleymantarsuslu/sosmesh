package com.sosmesh.android.core.wear.companion.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WearPowerRetryPolicyTest {
    @Test
    fun batterySaver_doublesRetryDelay() {
        assertEquals(10_000L, WearPowerRetryPolicy.effectiveRetryDelayMs(5_000L, batterySaverEnabled = true))
        assertEquals(5_000L, WearPowerRetryPolicy.effectiveRetryDelayMs(5_000L, batterySaverEnabled = false))
    }

    @Test
    fun batterySaver_exposesUserFacingDetail() {
        assertNull(WearPowerRetryPolicy.batterySaverDetailTr(batterySaverEnabled = false))
        assertEquals(
            "Pil tasarrufu açık; yeniden deneme daha seyrek.",
            WearPowerRetryPolicy.batterySaverDetailTr(batterySaverEnabled = true),
        )
    }
}
