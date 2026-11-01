package com.sosmesh.android.core.platform

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import java.io.File

class AdaptiveRadioPlannerCrossLanguageTest {
    @Test
    fun crossLanguageVectorsMatchGolden() {
        val vectorsFile =
            File("../../../../packages/contracts/radio-planner/vectors/radio-planner-cases.json")
                .canonicalFile
        val root = JSONObject(vectorsFile.readText())
        val cases = root.getJSONArray("cases")
        for (index in 0 until cases.length()) {
            val case = cases.getJSONObject(index)
            val id = case.getString("id")
            val inputJson = case.getJSONObject("input")
            val expect = case.getJSONObject("expect")
            val input =
                RadioPlannerInput(
                    bluetoothEnabled = inputJson.getBoolean("bluetoothEnabled"),
                    blePermissionsGranted = inputJson.getBoolean("blePermissionsGranted"),
                    sosTransferActive = inputJson.getBoolean("sosTransferActive"),
                    relayOptIn = inputJson.getBoolean("relayOptIn"),
                    batteryLevelPercent = inputJson.getInt("batteryLevelPercent"),
                    batteryLowThresholdPercent = inputJson.getInt("batteryLowThresholdPercent"),
                    powerSaveEnabled = inputJson.getBoolean("powerSaveEnabled"),
                    deviceIdle = inputJson.getBoolean("deviceIdle"),
                    thermalThrottled = inputJson.getBoolean("thermalThrottled"),
                    highPowerRadioConsent = inputJson.getBoolean("highPowerRadioConsent"),
                    duplicateTrafficRatioBps = inputJson.getInt("duplicateTrafficRatioBps"),
                    linkQualityScoreBps = inputJson.getInt("linkQualityScoreBps"),
                )
            val decision = AdaptiveRadioPlanner.plan(input)
            assertEquals("case $id profileId", expect.getString("profileId"), decision.profileId.name)
            assertEquals("case $id scanMode", expect.getInt("scanMode"), decision.radioProfile.scanMode)
            assertEquals("case $id scanPeriodMs", expect.getLong("scanPeriodMs"), decision.radioProfile.scanPeriodMs)
            assertEquals("case $id scanPauseMs", expect.getLong("scanPauseMs"), decision.radioProfile.scanPauseMs)
            assertEquals(
                "case $id scanningAllowed",
                expect.getBoolean("scanningAllowed"),
                decision.radioProfile.scanningAllowed,
            )
            assertEquals(
                "case $id advertiseIntervalMs",
                expect.getLong("advertiseIntervalMs"),
                decision.radioProfile.advertiseIntervalMs,
            )
            assertEquals(
                "case $id advertiseAllowed",
                expect.getBoolean("advertiseAllowed"),
                decision.radioProfile.advertiseAllowed,
            )
            assertEquals(
                "case $id requiresHighPowerConsentPrompt",
                expect.getBoolean("requiresHighPowerConsentPrompt"),
                decision.requiresHighPowerConsentPrompt,
            )
            assertEquals(
                "case $id dutyCycleClass",
                expect.getString("dutyCycleClass"),
                decision.dutyCycleClass.name,
            )
        }
    }
}

class AdaptiveRadioPlannerMutationTest {
    @Test
    fun ignoreLowPowerConstraints_changesSosConstrainedVsBaseline() {
        val input =
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
        val baseline = AdaptiveRadioPlanner.plan(input)
        assertEquals(RadioProfileId.SOS_CONSTRAINED, baseline.profileId)

        val mutated =
            AdaptiveRadioPlanner.plan(
                input,
                RadioPlannerTestingHooks(ignoreLowPowerConstraints = true),
            )
        assertEquals(RadioProfileId.SOS_URGENT, mutated.profileId)
    }

    @Test
    fun ignoreLowPowerConstraints_changesRelayConstrainedVsBaseline() {
        val input =
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
        val baseline = AdaptiveRadioPlanner.plan(input)
        assertEquals(RadioProfileId.RELAY_CONSTRAINED, baseline.profileId)

        val mutated =
            AdaptiveRadioPlanner.plan(
                input,
                RadioPlannerTestingHooks(ignoreLowPowerConstraints = true),
            )
        assertEquals(RadioProfileId.RELAY_PASSIVE, mutated.profileId)
        assertFalse(mutated.requiresHighPowerConsentPrompt)
    }
}
