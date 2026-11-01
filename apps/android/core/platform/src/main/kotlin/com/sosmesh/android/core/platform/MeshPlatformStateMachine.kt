package com.sosmesh.android.core.platform

/**
 * Reduces OS/network/BLE/battery signals into an operational mode and radio energy profile (ADIM 30/42).
 * Does not claim background execution guarantees — callers surface [PlatformUserHint] in UI instead.
 */
class MeshPlatformStateMachine(
    initial: MeshPlatformState = MeshPlatformState.initial(),
) {
    private var platformState: MeshPlatformState = initial

    fun currentState(): MeshPlatformState = platformState

    fun currentEvaluation(): MeshPlatformEvaluation = evaluate(platformState)

    fun reduce(event: MeshPlatformEvent): MeshPlatformEvaluation {
        platformState = applyEvent(platformState, event)
        return evaluate(platformState)
    }

    fun evaluateSnapshot(snapshot: MeshPlatformState): MeshPlatformEvaluation = evaluate(snapshot)

    private fun applyEvent(
        state: MeshPlatformState,
        event: MeshPlatformEvent,
    ): MeshPlatformState =
        when (event) {
            MeshPlatformEvent.NetworkAvailable -> state.copy(networkValidated = true)
            MeshPlatformEvent.NetworkLost -> state.copy(networkValidated = false)
            MeshPlatformEvent.BluetoothEnabled -> state.copy(bluetoothEnabled = true)
            MeshPlatformEvent.BluetoothDisabled -> state.copy(bluetoothEnabled = false)
            MeshPlatformEvent.BlePermissionsGranted -> state.copy(blePermissionsGranted = true)
            MeshPlatformEvent.BlePermissionsDenied -> state.copy(blePermissionsGranted = false)
            is MeshPlatformEvent.BatteryLevelChanged ->
                state.copy(
                    batteryLevelPercent = event.percent.coerceIn(0, 100),
                )
            MeshPlatformEvent.PowerSaveEnabled -> state.copy(powerSaveEnabled = true)
            MeshPlatformEvent.PowerSaveDisabled -> state.copy(powerSaveEnabled = false)
            MeshPlatformEvent.DeviceIdleEnter -> state.copy(deviceIdle = true)
            MeshPlatformEvent.DeviceIdleExit -> state.copy(deviceIdle = false)
            MeshPlatformEvent.SosTransferStarted -> state.copy(sosTransferActive = true)
            MeshPlatformEvent.SosTransferEnded -> state.copy(sosTransferActive = false)
            MeshPlatformEvent.RelayOptIn -> state.copy(relayOptIn = true)
            MeshPlatformEvent.RelayOptOut -> state.copy(relayOptIn = false)
            MeshPlatformEvent.ThermalThrottled -> state.copy(thermalThrottled = true)
            MeshPlatformEvent.ThermalNormal -> state.copy(thermalThrottled = false)
            MeshPlatformEvent.HighPowerRadioConsentGranted -> state.copy(highPowerRadioConsent = true)
            MeshPlatformEvent.HighPowerRadioConsentRevoked -> state.copy(highPowerRadioConsent = false)
            is MeshPlatformEvent.LinkMetricsUpdated ->
                state.copy(
                    duplicateTrafficRatioBps = event.duplicateTrafficRatioBps.coerceIn(0, 10_000),
                    linkQualityScoreBps = event.linkQualityScoreBps.coerceIn(0, 10_000),
                )
        }

    private fun evaluate(state: MeshPlatformState): MeshPlatformEvaluation {
        val radioDecision = AdaptiveRadioPlanner.plan(RadioPlannerInput.fromPlatformState(state))

        if (!state.bluetoothEnabled) {
            return blockedEvaluation(state, MeshBlockReason.BLUETOOTH_OFF, PlatformUserHint.FIX_BLUETOOTH, radioDecision)
        }
        if (!state.blePermissionsGranted) {
            return blockedEvaluation(state, MeshBlockReason.PERMISSION_DENIED, PlatformUserHint.FIX_PERMISSIONS, radioDecision)
        }
        if (state.batteryCritical && state.relayOptIn && !state.sosTransferActive) {
            return blockedEvaluation(
                state,
                MeshBlockReason.BATTERY_CRITICAL,
                PlatformUserHint.LOW_BATTERY_RELAY_PAUSED,
                radioDecision,
            )
        }

        val constrained = state.powerSaveEnabled || state.deviceIdle || state.thermalThrottled
        val mode =
            when {
                state.sosTransferActive -> MeshOperationalMode.SOS_ACTIVE
                state.relayOptIn && !state.batteryCritical -> MeshOperationalMode.RELAY_ACTIVE
                constrained -> MeshOperationalMode.CONSTRAINED
                else -> MeshOperationalMode.IDLE
            }

        val relayMayRun = state.relayOptIn && !state.batteryCritical && state.bluetoothEnabled && state.blePermissionsGranted
        val relayUploadMayRun = relayMayRun && state.networkValidated

        val hint =
            when {
                !state.networkValidated && state.relayOptIn -> PlatformUserHint.NETWORK_OFFLINE_RELAY
                constrained && state.relayOptIn -> PlatformUserHint.POWER_SAVE_CONSTRAINED
                else -> PlatformUserHint.NONE
            }

        return MeshPlatformEvaluation(
            state = state,
            mode = mode,
            blockReason = null,
            radioProfile = radioDecision.radioProfile,
            relayMayRun = relayMayRun,
            relayUploadMayRun = relayUploadMayRun,
            userHint = hint,
            requiresHighPowerRadioConsent = radioDecision.requiresHighPowerConsentPrompt,
        )
    }

    private fun blockedEvaluation(
        state: MeshPlatformState,
        reason: MeshBlockReason,
        hint: PlatformUserHint,
        radioDecision: RadioPlannerDecision,
    ): MeshPlatformEvaluation {
        val sosStillScans = state.sosTransferActive && reason != MeshBlockReason.PERMISSION_DENIED
        val profile =
            if (sosStillScans) {
                AdaptiveRadioPlanner.plan(RadioPlannerInput.fromPlatformState(state)).radioProfile
            } else {
                radioDecision.radioProfile
            }
        return MeshPlatformEvaluation(
            state = state,
            mode = MeshOperationalMode.BLOCKED,
            blockReason = reason,
            radioProfile = profile,
            relayMayRun = false,
            relayUploadMayRun = false,
            userHint = hint,
            requiresHighPowerRadioConsent = false,
        )
    }
}
