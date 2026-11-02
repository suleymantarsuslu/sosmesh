package com.sosmesh.android.wear.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WearAmbientUiPolicyTest {
    @Test
    fun ambientMode_hidesSecondaryDetail() {
        assertTrue(WearAmbientUiPolicy.hideSecondaryDetailInAmbient(isAmbient = true))
        assertFalse(WearAmbientUiPolicy.hideSecondaryDetailInAmbient(isAmbient = false))
    }

    @Test
    fun ambientMode_usesBurnInSafePalette() {
        assertNotEquals(
            WearAmbientUiPolicy.sosBackground(isAmbient = false),
            WearAmbientUiPolicy.sosBackground(isAmbient = true),
        )
        assertNotEquals(
            WearAmbientUiPolicy.primaryText(isAmbient = false),
            WearAmbientUiPolicy.primaryText(isAmbient = true),
        )
    }
}
