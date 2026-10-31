package com.sosmesh.android.feature.relay.ui

import com.sosmesh.android.feature.relay.battery.RelayPauseReason

data class RelayUiState(
    val relayEnabled: Boolean = false,
    val sessionRunning: Boolean = false,
    val pendingUploadCount: Int = 0,
    val batteryLevelPercent: Int = 100,
    val isCharging: Boolean = false,
    val estimatedBatteryImpactPercentPerHour: Int = 0,
    val pauseReason: RelayPauseReason? = null,
    val batteryThresholdPercent: Int = 20,
    val hourlyDataLimitMb: Int = 5,
    val systemConstraintSummary: String = "",
    val systemConstraintDetail: String = "",
)
