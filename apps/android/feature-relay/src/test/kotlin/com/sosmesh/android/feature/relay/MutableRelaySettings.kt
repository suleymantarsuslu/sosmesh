package com.sosmesh.android.feature.relay

import com.sosmesh.android.feature.relay.settings.RelaySettingsPort

class MutableRelaySettings(
    var relayEnabled: Boolean = false,
    var batteryThreshold: Int = 20,
    var hourlyLimitBytes: Long = 5L * 1024L * 1024L,
) : RelaySettingsPort {
    override fun isRelayEnabled(): Boolean = relayEnabled

    override fun batteryThresholdPercent(): Int = batteryThreshold

    override fun hourlyDataLimitBytes(): Long = hourlyLimitBytes
}
