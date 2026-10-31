package com.sosmesh.android.core.ble

/**
 * Scan duty-cycle constants for foreground low-power discovery (ADIM 14).
 * Values align with Android SCAN_MODE_LOW_POWER expectations (longer interval).
 */
object BleScanProfile {
    const val FOREGROUND_LOW_POWER_SCAN_MODE: Int = 0
    const val BACKGROUND_BALANCED_SCAN_MODE: Int = 1

    /** Minimum ms between scan restarts when screen is visible (low power). */
    const val FOREGROUND_SCAN_PERIOD_MS: Long = 10_000L

    /** Pause between scan windows on foreground low-power profile. */
    const val FOREGROUND_SCAN_PAUSE_MS: Long = 5_000L
}
