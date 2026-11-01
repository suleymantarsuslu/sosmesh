package com.sosmesh.android.core.platform

data class MeshPlatformState(
    val networkValidated: Boolean = false,
    val bluetoothEnabled: Boolean = true,
    val blePermissionsGranted: Boolean = true,
    val batteryLevelPercent: Int = 100,
    val batteryLowThresholdPercent: Int = 15,
    val powerSaveEnabled: Boolean = false,
    val deviceIdle: Boolean = false,
    val relayOptIn: Boolean = false,
    val sosTransferActive: Boolean = false,
) {
    val batteryCritical: Boolean
        get() = batteryLevelPercent < batteryLowThresholdPercent

    companion object {
        fun initial(): MeshPlatformState = MeshPlatformState()
    }
}

enum class MeshOperationalMode {
    IDLE,
    SOS_ACTIVE,
    RELAY_ACTIVE,
    CONSTRAINED,
    BLOCKED,
}

enum class MeshBlockReason {
    BLUETOOTH_OFF,
    PERMISSION_DENIED,
    BATTERY_CRITICAL,
}

enum class PlatformUserHint {
    NONE,
    FIX_BLUETOOTH,
    FIX_PERMISSIONS,
    LOW_BATTERY_RELAY_PAUSED,
    NETWORK_OFFLINE_RELAY,
    POWER_SAVE_CONSTRAINED,
}

data class MeshPlatformEvaluation(
    val state: MeshPlatformState,
    val mode: MeshOperationalMode,
    val blockReason: MeshBlockReason?,
    val radioProfile: EnergyRadioProfile,
    val relayMayRun: Boolean,
    val relayUploadMayRun: Boolean,
    val userHint: PlatformUserHint,
)
