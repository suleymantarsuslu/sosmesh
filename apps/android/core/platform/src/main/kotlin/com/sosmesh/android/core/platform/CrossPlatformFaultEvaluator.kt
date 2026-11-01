package com.sosmesh.android.core.platform

enum class CrossPlatformFaultHint {
    NONE,
    FIX_BLUETOOTH,
    FIX_PERMISSIONS,
    LOCATION_UNAVAILABLE,
    TRANSFER_CORRUPT,
    API_UPLOAD_FAILED,
    NETWORK_OFFLINE_RELAY,
    LOW_BATTERY_RELAY_PAUSED,
}

data class CrossPlatformFaultState(
    val bluetoothEnabled: Boolean = true,
    val blePermissionsGranted: Boolean = true,
    val locationAvailable: Boolean = true,
    val networkValidated: Boolean = false,
    val batteryLevelPercent: Int = 100,
    val relayOptIn: Boolean = false,
    val lastTransferCorrupt: Boolean = false,
    val lastApiUploadFailed: Boolean = false,
)

object CrossPlatformFaultEvaluator {
    private const val BATTERY_LOW_THRESHOLD = 15

    fun userHint(state: CrossPlatformFaultState): CrossPlatformFaultHint {
        if (state.lastTransferCorrupt) return CrossPlatformFaultHint.TRANSFER_CORRUPT
        if (state.lastApiUploadFailed) return CrossPlatformFaultHint.API_UPLOAD_FAILED
        if (!state.bluetoothEnabled) return CrossPlatformFaultHint.FIX_BLUETOOTH
        if (!state.blePermissionsGranted) return CrossPlatformFaultHint.FIX_PERMISSIONS
        if (!state.locationAvailable) return CrossPlatformFaultHint.LOCATION_UNAVAILABLE
        if (state.relayOptIn && state.batteryLevelPercent < BATTERY_LOW_THRESHOLD) {
            return CrossPlatformFaultHint.LOW_BATTERY_RELAY_PAUSED
        }
        if (state.relayOptIn && !state.networkValidated) {
            return CrossPlatformFaultHint.NETWORK_OFFLINE_RELAY
        }
        return CrossPlatformFaultHint.NONE
    }
}
