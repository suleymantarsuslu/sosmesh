package com.sosmesh.android.core.platform

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import java.nio.file.Paths

class AdaptiveRadioPlannerCrossLanguageTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun crossLanguageVectorsMatchGolden() {
        val vectorsPath =
            Paths.get(
                System.getProperty("user.dir"),
                "..",
                "..",
                "..",
                "..",
                "packages",
                "contracts",
                "radio-planner",
                "vectors",
                "radio-planner-cases.json",
            ).normalize()
        val root = json.parseToJsonElement(vectorsPath.toFile().readText()).jsonObject
        val cases = root.getValue("cases").jsonArray
        for (element in cases) {
            val case = element.jsonObject
            val id = case.getValue("id").jsonPrimitive.content
            val inputJson = case.getValue("input").jsonObject
            val expect = case.getValue("expect").jsonObject
            val input =
                RadioPlannerInput(
                    bluetoothEnabled = inputJson.getValue("bluetoothEnabled").jsonPrimitive.boolean,
                    blePermissionsGranted = inputJson.getValue("blePermissionsGranted").jsonPrimitive.boolean,
                    sosTransferActive = inputJson.getValue("sosTransferActive").jsonPrimitive.boolean,
                    relayOptIn = inputJson.getValue("relayOptIn").jsonPrimitive.boolean,
                    batteryLevelPercent = inputJson.getValue("batteryLevelPercent").jsonPrimitive.int,
                    batteryLowThresholdPercent =
                        inputJson.getValue("batteryLowThresholdPercent").jsonPrimitive.int,
                    powerSaveEnabled = inputJson.getValue("powerSaveEnabled").jsonPrimitive.boolean,
                    deviceIdle = inputJson.getValue("deviceIdle").jsonPrimitive.boolean,
                    thermalThrottled = inputJson.getValue("thermalThrottled").jsonPrimitive.boolean,
                    highPowerRadioConsent = inputJson.getValue("highPowerRadioConsent").jsonPrimitive.boolean,
                    duplicateTrafficRatioBps = inputJson.getValue("duplicateTrafficRatioBps").jsonPrimitive.int,
                    linkQualityScoreBps = inputJson.getValue("linkQualityScoreBps").jsonPrimitive.int,
                )
            val decision = AdaptiveRadioPlanner.plan(input)
            assertEquals(
                "case $id profileId",
                expect.getValue("profileId").jsonPrimitive.content,
                decision.profileId.name,
            )
            assertEquals(
                "case $id scanMode",
                expect.getValue("scanMode").jsonPrimitive.int,
                decision.radioProfile.scanMode,
            )
            assertEquals(
                "case $id scanPeriodMs",
                expect.getValue("scanPeriodMs").jsonPrimitive.long,
                decision.radioProfile.scanPeriodMs,
            )
            assertEquals(
                "case $id scanPauseMs",
                expect.getValue("scanPauseMs").jsonPrimitive.long,
                decision.radioProfile.scanPauseMs,
            )
            assertEquals(
                "case $id scanningAllowed",
                expect.getValue("scanningAllowed").jsonPrimitive.boolean,
                decision.radioProfile.scanningAllowed,
            )
            assertEquals(
                "case $id advertiseIntervalMs",
                expect.getValue("advertiseIntervalMs").jsonPrimitive.long,
                decision.radioProfile.advertiseIntervalMs,
            )
            assertEquals(
                "case $id advertiseAllowed",
                expect.getValue("advertiseAllowed").jsonPrimitive.boolean,
                decision.radioProfile.advertiseAllowed,
            )
            assertEquals(
                "case $id requiresHighPowerConsentPrompt",
                expect.getValue("requiresHighPowerConsentPrompt").jsonPrimitive.boolean,
                decision.requiresHighPowerConsentPrompt,
            )
            assertEquals(
                "case $id dutyCycleClass",
                expect.getValue("dutyCycleClass").jsonPrimitive.content,
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
            AdaptiveRadioPlannerTesting.plan(
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
            AdaptiveRadioPlannerTesting.plan(
                input,
                RadioPlannerTestingHooks(ignoreLowPowerConstraints = true),
            )
        assertEquals(RadioProfileId.RELAY_PASSIVE, mutated.profileId)
        assertFalse(mutated.requiresHighPowerConsentPrompt)
    }
}
