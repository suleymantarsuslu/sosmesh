package com.sosmesh.android.core.platform

/**
 * Reduces OS/network/BLE/battery signals into an operational mode and radio energy profile (ADIM 30).
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
        }

    private fun evaluate(state: MeshPlatformState): MeshPlatformEvaluation {
        if (!state.bluetoothEnabled) {
            return blocked(state, MeshBlockReason.BLUETOOTH_OFF, PlatformUserHint.FIX_BLUETOOTH)
        }
        if (!state.blePermissionsGranted) {
            return blocked(state, MeshBlockReason.PERMISSION_DENIED, PlatformUserHint.FIX_PERMISSIONS)
        }
        if (state.batteryCritical && state.relayOptIn && !state.sosTransferActive) {
            return blocked(state, MeshBlockReason.BATTERY_CRITICAL, PlatformUserHint.LOW_BATTERY_RELAY_PAUSED)
        }

        val constrained = state.powerSaveEnabled || state.deviceIdle
        val mode =
            when {
                state.sosTransferActive -> MeshOperationalMode.SOS_ACTIVE
                state.relayOptIn && !state.batteryCritical -> MeshOperationalMode.RELAY_ACTIVE
                constrained -> MeshOperationalMode.CONSTRAINED
                else -> MeshOperationalMode.IDLE
            }

        val profile =
            when {
                state.sosTransferActive -> EnergyRadioProfile.SOS_URGENT
                state.powerSaveEnabled || state.deviceIdle -> EnergyRadioProfile.CONSTRAINED
                state.relayOptIn -> EnergyRadioProfile.RELAY_FOREGROUND_LOW_POWER
                else -> EnergyRadioProfile.RELAY_FOREGROUND_LOW_POWER
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
            radioProfile = profile,
            relayMayRun = relayMayRun,
            relayUploadMayRun = relayUploadMayRun,
            userHint = hint,
        )
    }

    private fun blocked(
        state: MeshPlatformState,
        reason: MeshBlockReason,
        hint: PlatformUserHint,
    ): MeshPlatformEvaluation {
        val sosStillScans = state.sosTransferActive && reason != MeshBlockReason.PERMISSION_DENIED
        val profile =
            if (sosStillScans) {
                EnergyRadioProfile.SOS_URGENT
            } else {
                EnergyRadioProfile.BLOCKED
            }
        return MeshPlatformEvaluation(
            state = state,
            mode = MeshOperationalMode.BLOCKED,
            blockReason = reason,
            radioProfile = profile,
            relayMayRun = false,
            relayUploadMayRun = false,
            userHint = hint,
        )
    }
}
