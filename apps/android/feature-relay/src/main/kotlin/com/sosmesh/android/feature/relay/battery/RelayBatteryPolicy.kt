package com.sosmesh.android.feature.relay.battery

import com.sosmesh.android.core.ble.BleScanProfile
import com.sosmesh.android.feature.relay.settings.RelayHourlyDataBudget
import com.sosmesh.android.feature.relay.settings.RelaySettingsPort
import javax.inject.Inject

data class RelayBatterySnapshot(
    val levelPercent: Int,
    val isCharging: Boolean,
)

enum class RelayPauseReason {
    UserDisabled,
    BatteryBelowThreshold,
    HourlyDataLimit,
}

data class RelayBatteryEvaluation(
    val mayRunRelay: Boolean,
    val pauseReason: RelayPauseReason?,
)

/**
 * Battery and hourly data guardrails for volunteer relay mode (ADIM 16).
 */
class RelayBatteryPolicy
    @Inject
    constructor(
        private val settings: RelaySettingsPort,
        private val hourlyBudget: RelayHourlyDataBudget,
    ) {
        fun evaluate(
            snapshot: RelayBatterySnapshot,
            relayEnabled: Boolean,
            nowMs: Long,
            nextUploadPayloadBytes: Int = 0,
        ): RelayBatteryEvaluation {
            if (!relayEnabled) {
                return RelayBatteryEvaluation(mayRunRelay = false, pauseReason = RelayPauseReason.UserDisabled)
            }
            val threshold = settings.batteryThresholdPercent()
            if (!snapshot.isCharging && snapshot.levelPercent < threshold) {
                return RelayBatteryEvaluation(
                    mayRunRelay = false,
                    pauseReason = RelayPauseReason.BatteryBelowThreshold,
                )
            }
            if (nextUploadPayloadBytes > 0) {
                val limit = settings.hourlyDataLimitBytes()
                if (!hourlyBudget.canSend(nextUploadPayloadBytes, limit, nowMs)) {
                    return RelayBatteryEvaluation(
                        mayRunRelay = true,
                        pauseReason = RelayPauseReason.HourlyDataLimit,
                    )
                }
            }
            return RelayBatteryEvaluation(mayRunRelay = true, pauseReason = null)
        }

        /** Rough UX estimate: low-power scan duty cycle + occasional upload. */
        fun estimateHourlyBatteryImpactPercent(relayActive: Boolean): Int {
            if (!relayActive) {
                return 0
            }
            val scanDutyFactor =
                BleScanProfile.FOREGROUND_SCAN_PERIOD_MS.toDouble() /
                    (BleScanProfile.FOREGROUND_SCAN_PERIOD_MS + BleScanProfile.FOREGROUND_SCAN_PAUSE_MS)
            val scanComponent = (scanDutyFactor * 4.0).toInt().coerceAtMost(6)
            return (scanComponent + 2).coerceAtMost(8)
        }
    }
