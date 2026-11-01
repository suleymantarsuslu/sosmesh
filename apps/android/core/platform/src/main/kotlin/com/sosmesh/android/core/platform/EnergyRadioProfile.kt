package com.sosmesh.android.core.platform

/**
 * Scan/advertise duty-cycle knobs (ADIM 30, extended ADIM 42).
 * SOS-active profiles stay more aggressive than passive relay.
 */
data class EnergyRadioProfile(
    val scanMode: Int,
    val scanPeriodMs: Long,
    val scanPauseMs: Long,
    val scanningAllowed: Boolean,
    val advertiseIntervalMs: Long = 0L,
    val advertiseAllowed: Boolean = false,
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
                advertiseIntervalMs = 0L,
                advertiseAllowed = false,
            )

        val RELAY_FOREGROUND_LOW_POWER =
            EnergyRadioProfile(
                scanMode = SCAN_MODE_LOW_POWER,
                scanPeriodMs = 10_000L,
                scanPauseMs = 5_000L,
                scanningAllowed = true,
                advertiseIntervalMs = 400L,
                advertiseAllowed = true,
            )

        val RELAY_HIGH_POWER =
            EnergyRadioProfile(
                scanMode = SCAN_MODE_BALANCED,
                scanPeriodMs = 7_000L,
                scanPauseMs = 3_000L,
                scanningAllowed = true,
                advertiseIntervalMs = 200L,
                advertiseAllowed = true,
            )

        val SOS_URGENT =
            EnergyRadioProfile(
                scanMode = SCAN_MODE_LOW_LATENCY,
                scanPeriodMs = 5_000L,
                scanPauseMs = 2_000L,
                scanningAllowed = true,
                advertiseIntervalMs = 160L,
                advertiseAllowed = true,
            )

        val SOS_CONSTRAINED =
            EnergyRadioProfile(
                scanMode = SCAN_MODE_BALANCED,
                scanPeriodMs = 8_000L,
                scanPauseMs = 4_000L,
                scanningAllowed = true,
                advertiseIntervalMs = 320L,
                advertiseAllowed = true,
            )

        val CONSTRAINED =
            EnergyRadioProfile(
                scanMode = SCAN_MODE_LOW_POWER,
                scanPeriodMs = 20_000L,
                scanPauseMs = 15_000L,
                scanningAllowed = true,
                advertiseIntervalMs = 800L,
                advertiseAllowed = true,
            )
    }
}
