package com.sosmesh.android.core.ble

import com.sosmesh.android.core.platform.EnergyRadioProfile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BleScannerEnergyProfileTest {
    @Test
    fun sosUrgentProfile_usesLowLatencyScanMode() {
        val requestMode = EnergyRadioProfile.SOS_URGENT.scanMode
        assertEquals(EnergyRadioProfile.SCAN_MODE_LOW_LATENCY, requestMode)
        assertTrue(EnergyRadioProfile.SOS_URGENT.scanPeriodMs < EnergyRadioProfile.RELAY_FOREGROUND_LOW_POWER.scanPeriodMs)
    }
}
