package com.sosmesh.android.feature.relay.settings

interface RelaySettingsPort {
    fun isRelayEnabled(): Boolean

    fun batteryThresholdPercent(): Int

    fun hourlyDataLimitBytes(): Long
}
