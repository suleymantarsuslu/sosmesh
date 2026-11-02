package com.sosmesh.android.core.platform

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CrossPlatformFaultEvaluatorTest {
    @Test
    fun corruptTransferTakesPriorityOverBluetooth() {
        val hint =
            CrossPlatformFaultEvaluator.userHint(
                CrossPlatformFaultState(
                    bluetoothEnabled = false,
                    lastTransferCorrupt = true,
                ),
            )
        assertEquals(CrossPlatformFaultHint.TRANSFER_CORRUPT, hint)
    }

    @Test
    fun locationUnavailableWhenGpsOff() {
        val hint =
            CrossPlatformFaultEvaluator.userHint(
                CrossPlatformFaultState(locationAvailable = false),
            )
        assertEquals(CrossPlatformFaultHint.LOCATION_UNAVAILABLE, hint)
    }

    @Test
    fun apiFailureHintWhenFlagSet() {
        val hint =
            CrossPlatformFaultEvaluator.userHint(
                CrossPlatformFaultState(lastApiUploadFailed = true),
            )
        assertTrue(hint == CrossPlatformFaultHint.API_UPLOAD_FAILED)
        assertFalse(hint == CrossPlatformFaultHint.NONE)
    }
}
