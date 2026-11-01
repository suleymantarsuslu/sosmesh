package com.sosmesh.android.core.platform

/**
 * Pure adaptive scan/advertise planner (ADIM 42).
 * Uses aggregate link-quality and duplicate-traffic metrics only — no location or PII.
 */
data class RadioPlannerInput(
    val bluetoothEnabled: Boolean,
    val blePermissionsGranted: Boolean,
    val sosTransferActive: Boolean,
    val relayOptIn: Boolean,
    val batteryLevelPercent: Int,
    val batteryLowThresholdPercent: Int,
    val powerSaveEnabled: Boolean,
    val deviceIdle: Boolean,
    val thermalThrottled: Boolean,
    val highPowerRadioConsent: Boolean,
    /** Duplicate relay traffic ratio in basis points (0–10000). */
    val duplicateTrafficRatioBps: Int,
    /** Coarse link quality score in basis points (0–10000); not GPS-derived. */
    val linkQualityScoreBps: Int,
) {
    val batteryCritical: Boolean
        get() = batteryLevelPercent < batteryLowThresholdPercent

    companion object {
        fun fromPlatformState(state: MeshPlatformState): RadioPlannerInput =
            RadioPlannerInput(
                bluetoothEnabled = state.bluetoothEnabled,
                blePermissionsGranted = state.blePermissionsGranted,
                sosTransferActive = state.sosTransferActive,
                relayOptIn = state.relayOptIn,
                batteryLevelPercent = state.batteryLevelPercent,
                batteryLowThresholdPercent = state.batteryLowThresholdPercent,
                powerSaveEnabled = state.powerSaveEnabled,
                deviceIdle = state.deviceIdle,
                thermalThrottled = state.thermalThrottled,
                highPowerRadioConsent = state.highPowerRadioConsent,
                duplicateTrafficRatioBps = state.duplicateTrafficRatioBps,
                linkQualityScoreBps = state.linkQualityScoreBps,
            )
    }
}

enum class RadioDutyCycleClass {
    SOS_ACTIVE,
    RELAY_PASSIVE,
    BLOCKED,
}

enum class RadioProfileId {
    BLOCKED,
    SOS_URGENT,
    SOS_CONSTRAINED,
    RELAY_PASSIVE,
    RELAY_CONSTRAINED,
    RELAY_HIGH_POWER,
}

data class RadioPlannerDecision(
    val profileId: RadioProfileId,
    val radioProfile: EnergyRadioProfile,
    val requiresHighPowerConsentPrompt: Boolean,
    val dutyCycleClass: RadioDutyCycleClass,
)

object AdaptiveRadioPlanner {
    private const val DUPLICATE_SLOW_THRESHOLD_BPS = 2500
    private const val LINK_POOR_THRESHOLD_BPS = 2500
    private const val DUPLICATE_LOW_FOR_BOOST_BPS = 2000
    private const val RELAY_BATTERY_SOFT_CONSTRAINED_PERCENT = 25

    fun plan(input: RadioPlannerInput): RadioPlannerDecision =
        planInternal(input, RadioPlannerTestingHooks.NONE)

    internal fun planInternal(
        input: RadioPlannerInput,
        testingHooks: RadioPlannerTestingHooks,
    ): RadioPlannerDecision {
        if (!input.blePermissionsGranted) {
            return blockedDecision()
        }
        if (!input.bluetoothEnabled) {
            return if (input.sosTransferActive) {
                sosDecision(input, testingHooks)
            } else {
                blockedDecision()
            }
        }
        if (input.batteryCritical && input.relayOptIn && !input.sosTransferActive) {
            return blockedDecision()
        }
        if (input.sosTransferActive) {
            return sosDecision(input, testingHooks)
        }
        if (input.relayOptIn) {
            return relayDecision(input, testingHooks)
        }
        return passiveIdleDecision(input, testingHooks)
    }

    private fun sosDecision(
        input: RadioPlannerInput,
        testingHooks: RadioPlannerTestingHooks,
    ): RadioPlannerDecision {
        val constrained =
            !testingHooks.ignoreLowPowerConstraints &&
                (input.thermalThrottled || input.powerSaveEnabled || input.deviceIdle)
        return if (constrained) {
            RadioPlannerDecision(
                profileId = RadioProfileId.SOS_CONSTRAINED,
                radioProfile = EnergyRadioProfile.SOS_CONSTRAINED,
                requiresHighPowerConsentPrompt = false,
                dutyCycleClass = RadioDutyCycleClass.SOS_ACTIVE,
            )
        } else {
            RadioPlannerDecision(
                profileId = RadioProfileId.SOS_URGENT,
                radioProfile = EnergyRadioProfile.SOS_URGENT,
                requiresHighPowerConsentPrompt = false,
                dutyCycleClass = RadioDutyCycleClass.SOS_ACTIVE,
            )
        }
    }

    private fun relayDecision(
        input: RadioPlannerInput,
        testingHooks: RadioPlannerTestingHooks,
    ): RadioPlannerDecision {
        val constrained =
            !testingHooks.ignoreLowPowerConstraints &&
                (input.powerSaveEnabled || input.deviceIdle || input.thermalThrottled ||
                    input.batteryLevelPercent < RELAY_BATTERY_SOFT_CONSTRAINED_PERCENT)
        if (constrained) {
            return RadioPlannerDecision(
                profileId = RadioProfileId.RELAY_CONSTRAINED,
                radioProfile = EnergyRadioProfile.CONSTRAINED,
                requiresHighPowerConsentPrompt = false,
                dutyCycleClass = RadioDutyCycleClass.RELAY_PASSIVE,
            )
        }

        val wantsBoost =
            input.linkQualityScoreBps < LINK_POOR_THRESHOLD_BPS &&
                input.duplicateTrafficRatioBps < DUPLICATE_LOW_FOR_BOOST_BPS
        if (wantsBoost && input.highPowerRadioConsent) {
            return RadioPlannerDecision(
                profileId = RadioProfileId.RELAY_HIGH_POWER,
                radioProfile = EnergyRadioProfile.RELAY_HIGH_POWER,
                requiresHighPowerConsentPrompt = false,
                dutyCycleClass = RadioDutyCycleClass.RELAY_PASSIVE,
            )
        }
        if (wantsBoost && !input.highPowerRadioConsent) {
            return passiveRelayWithPause(input, requiresConsentPrompt = true)
        }
        return passiveRelayWithPause(input, requiresConsentPrompt = false)
    }

    private fun passiveIdleDecision(
        input: RadioPlannerInput,
        testingHooks: RadioPlannerTestingHooks,
    ): RadioPlannerDecision = passiveRelayWithPause(input, requiresConsentPrompt = false)

    private fun passiveRelayWithPause(
        input: RadioPlannerInput,
        requiresConsentPrompt: Boolean,
    ): RadioPlannerDecision {
        val base = EnergyRadioProfile.RELAY_FOREGROUND_LOW_POWER
        val extraPause =
            if (input.duplicateTrafficRatioBps >= DUPLICATE_SLOW_THRESHOLD_BPS) {
                base.scanPauseMs / 2
            } else {
                0L
            }
        val profile =
            if (extraPause > 0L) {
                base.copy(scanPauseMs = base.scanPauseMs + extraPause)
            } else {
                base
            }
        return RadioPlannerDecision(
            profileId = RadioProfileId.RELAY_PASSIVE,
            radioProfile = profile,
            requiresHighPowerConsentPrompt = requiresConsentPrompt,
            dutyCycleClass = RadioDutyCycleClass.RELAY_PASSIVE,
        )
    }

    private fun blockedDecision(): RadioPlannerDecision =
        RadioPlannerDecision(
            profileId = RadioProfileId.BLOCKED,
            radioProfile = EnergyRadioProfile.BLOCKED,
            requiresHighPowerConsentPrompt = false,
            dutyCycleClass = RadioDutyCycleClass.BLOCKED,
        )
}
