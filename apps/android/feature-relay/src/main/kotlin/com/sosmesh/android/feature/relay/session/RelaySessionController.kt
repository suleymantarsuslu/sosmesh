package com.sosmesh.android.feature.relay.session

import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.feature.relay.battery.RelayBatteryPolicy
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshot
import com.sosmesh.android.feature.relay.battery.RelayPauseReason
import com.sosmesh.android.feature.relay.settings.RelaySettingsStore
import com.sosmesh.android.feature.relay.upload.RelayUploadCommands
import com.sosmesh.android.feature.relay.mesh.MeshRelayForwardOrchestrator
import javax.inject.Inject
import javax.inject.Singleton

enum class RelaySessionStopReason {
    UserDisabled,
    BatteryBelowThreshold,
}

data class RelaySessionStatus(
    val running: Boolean,
    val pauseReason: RelayPauseReason?,
    val stopReason: RelaySessionStopReason?,
)

/**
 * Starts/stops BLE discovery and upload scheduling according to opt-in and battery policy.
 */
@Singleton
class RelaySessionController
    @Inject
    constructor(
        private val settings: RelaySettingsStore,
        private val batteryPolicy: RelayBatteryPolicy,
        private val bleMeshRadio: BleMeshRadio,
        private val foregroundLauncher: RelayForegroundLauncher,
        private val uploadScheduler: RelayUploadCommands,
        private val meshForwardOrchestrator: MeshRelayForwardOrchestrator,
    ) {
        private var sessionRunning: Boolean = false

        fun refresh(
            battery: RelayBatterySnapshot,
            screenVisible: Boolean,
            nowMs: Long,
        ): RelaySessionStatus {
            if (!settings.isRelayEnabled()) {
                stopInternal(RelaySessionStopReason.UserDisabled)
                return RelaySessionStatus(
                    running = false,
                    pauseReason = RelayPauseReason.UserDisabled,
                    stopReason = RelaySessionStopReason.UserDisabled,
                )
            }
            val eval =
                batteryPolicy.evaluate(
                    battery,
                    relayEnabled = true,
                    nowMs = nowMs,
                    nextUploadPayloadBytes = 0,
                )
            if (!eval.mayRunRelay) {
                stopInternal(RelaySessionStopReason.BatteryBelowThreshold)
                return RelaySessionStatus(
                    running = false,
                    pauseReason = eval.pauseReason,
                    stopReason = RelaySessionStopReason.BatteryBelowThreshold,
                )
            }
            if (!sessionRunning) {
                foregroundLauncher.startForegroundRelay()
                val discoveryVisible = screenVisible
                bleMeshRadio.startPeerDiscovery(foregroundVisible = discoveryVisible)
                uploadScheduler.scheduleUpload(nowMs)
                sessionRunning = true
            } else {
                bleMeshRadio.startPeerDiscovery(foregroundVisible = screenVisible)
            }
            meshForwardOrchestrator.runForwardCycle(foregroundVisible = screenVisible)
            return RelaySessionStatus(
                running = true,
                pauseReason = eval.pauseReason,
                stopReason = null,
            )
        }

        fun stopByUser() {
            settings.setRelayEnabled(false)
            stopInternal(RelaySessionStopReason.UserDisabled)
        }

        fun stopInternal(reason: RelaySessionStopReason) {
            if (sessionRunning) {
                bleMeshRadio.stopPeerDiscovery()
                foregroundLauncher.stopForegroundRelay()
                uploadScheduler.cancelUpload()
                sessionRunning = false
            } else if (reason == RelaySessionStopReason.UserDisabled) {
                foregroundLauncher.stopForegroundRelay()
                uploadScheduler.cancelUpload()
            }
        }

        fun isSessionRunning(): Boolean = sessionRunning
    }
