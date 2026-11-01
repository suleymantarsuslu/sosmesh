package com.sosmesh.android.core.platform

import org.junit.Assert.assertEquals
import org.junit.Test

class AdaptiveRadioPlannerProductionGuardTest {
    @Test
    fun productionPlan_enforcesLowPowerConstraintsWithoutTestingHooks() {
        val sosInput =
            RadioPlannerInput(
                bluetoothEnabled = true,
                blePermissionsGranted = true,
                sosTransferActive = true,
                relayOptIn = false,
                batteryLevelPercent = 70,
                batteryLowThresholdPercent = 15,
                powerSaveEnabled = false,
                deviceIdle = false,
                thermalThrottled = true,
                highPowerRadioConsent = false,
                duplicateTrafficRatioBps = 0,
                linkQualityScoreBps = 5000,
            )
        assertEquals(
            RadioProfileId.SOS_CONSTRAINED,
            AdaptiveRadioPlanner.plan(sosInput).profileId,
        )

        val relayInput =
            RadioPlannerInput(
                bluetoothEnabled = true,
                blePermissionsGranted = true,
                sosTransferActive = false,
                relayOptIn = true,
                batteryLevelPercent = 55,
                batteryLowThresholdPercent = 15,
                powerSaveEnabled = true,
                deviceIdle = false,
                thermalThrottled = false,
                highPowerRadioConsent = true,
                duplicateTrafficRatioBps = 0,
                linkQualityScoreBps = 5000,
            )
        assertEquals(
            RadioProfileId.RELAY_CONSTRAINED,
            AdaptiveRadioPlanner.plan(relayInput).profileId,
        )
    }
}
