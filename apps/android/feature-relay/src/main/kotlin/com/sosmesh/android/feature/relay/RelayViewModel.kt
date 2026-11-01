package com.sosmesh.android.feature.relay

import androidx.lifecycle.ViewModel
import com.sosmesh.android.core.data.outbox.RelayOutboxReader
import com.sosmesh.android.feature.relay.battery.RelayBatteryPolicy
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshotReader
import com.sosmesh.android.feature.relay.battery.RelayPauseReason
import com.sosmesh.android.feature.relay.session.RelaySessionController
import com.sosmesh.android.feature.relay.settings.RelaySettingsStore
import com.sosmesh.android.feature.relay.system.RelaySystemConstraints
import com.sosmesh.android.feature.relay.ui.RelayUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class RelayViewModel
    @Inject
    constructor(
        private val settings: RelaySettingsStore,
        private val sessionController: RelaySessionController,
        private val batteryReader: RelayBatterySnapshotReader,
        private val batteryPolicy: RelayBatteryPolicy,
        private val outboxReader: RelayOutboxReader,
        private val systemConstraints: RelaySystemConstraints,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(RelayUiState())
        val uiState: StateFlow<RelayUiState> = _uiState.asStateFlow()

        init {
            refresh(screenVisible = true)
        }

        fun refresh(screenVisible: Boolean) {
            val nowMs = System.currentTimeMillis()
            val battery = batteryReader.read()
            val enabled = settings.isRelayEnabled()
            val session = sessionController.refresh(battery, screenVisible, nowMs)
            val pending = outboxReader.countPendingRelayUpload(nowMs)
            val english = Locale.getDefault().language.startsWith("en")
            val constraints = systemConstraints.describe(english)
            val eval =
                batteryPolicy.evaluate(
                    battery,
                    enabled,
                    nowMs,
                    nextUploadPayloadBytes = 0,
                )
            _uiState.value =
                RelayUiState(
                    relayEnabled = enabled,
                    sessionRunning = session.running,
                    pendingUploadCount = pending,
                    batteryLevelPercent = battery.levelPercent,
                    isCharging = battery.isCharging,
                    estimatedBatteryImpactPercentPerHour =
                        batteryPolicy.estimateHourlyBatteryImpactPercent(session.running),
                    pauseReason = session.pauseReason ?: eval.pauseReason,
                    batteryThresholdPercent = settings.batteryThresholdPercent(),
                    hourlyDataLimitMb =
                        (settings.hourlyDataLimitBytes() / (1024 * 1024)).toInt().coerceAtLeast(1),
                    systemConstraintSummary = constraints.summary,
                    systemConstraintDetail = constraints.detail,
                )
        }

        fun setRelayEnabled(enabled: Boolean) {
            settings.setRelayEnabled(enabled)
            if (!enabled) {
                sessionController.stopByUser()
            }
            refresh(screenVisible = true)
        }

        fun stopRelayAndExit(onExit: () -> Unit) {
            sessionController.stopByUser()
            refresh(screenVisible = false)
            onExit()
        }

        fun pauseReasonLabel(reason: RelayPauseReason?): String? =
            when (reason) {
                RelayPauseReason.UserDisabled -> null
                RelayPauseReason.BatteryBelowThreshold -> "battery_below_threshold"
                RelayPauseReason.HourlyDataLimit -> "hourly_data_limit"
                null -> null
            }
    }
