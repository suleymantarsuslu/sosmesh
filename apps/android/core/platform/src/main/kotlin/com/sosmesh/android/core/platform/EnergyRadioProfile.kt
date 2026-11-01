package com.sosmesh.android.core.platform

/**
 * Scan/advertise duty-cycle knobs (ADIM 30). SOS-active profiles stay more aggressive than passive relay.
 */
data class EnergyRadioProfile(
    val scanMode: Int,
    val scanPeriodMs: Long,
    val scanPauseMs: Long,
    val scanningAllowed: Boolean,
) {
    companion object {
        const val SCAN_MODE_LOW_POWER: Int = 0
        const val SCAN_MODE_BALANCED: Int = 1
        const val SCAN_MODE_LOW_LATENCY: Int = 2

        val BLOCKED =
            EnergyRadioProfile(
                scanMode = SCAN_MODE_LOW_POWER,
                scanPeriodMs = 0L,
                scanPauseMs = 0L,
                scanningAllowed = false,
            )

        val RELAY_FOREGROUND_LOW_POWER =
            EnergyRadioProfile(
                scanMode = SCAN_MODE_LOW_POWER,
                scanPeriodMs = 10_000L,
                scanPauseMs = 5_000L,
                scanningAllowed = true,
            )

        val SOS_URGENT =
            EnergyRadioProfile(
                scanMode = SCAN_MODE_LOW_LATENCY,
                scanPeriodMs = 5_000L,
                scanPauseMs = 2_000L,
                scanningAllowed = true,
            )

        val CONSTRAINED =
            EnergyRadioProfile(
                scanMode = SCAN_MODE_LOW_POWER,
                scanPeriodMs = 20_000L,
                scanPauseMs = 15_000L,
                scanningAllowed = true,
            )
    }
}
