package com.sosmesh.android.platform

import android.content.Context
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.PowerManager
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.platform.MeshPlatformEvaluation
import com.sosmesh.android.core.platform.MeshPlatformEvent
import com.sosmesh.android.core.platform.MeshPlatformState
import com.sosmesh.android.core.platform.MeshPlatformStateMachine
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshotReader
import com.sosmesh.android.feature.relay.settings.RelaySettingsStore
import com.sosmesh.android.ui.settings.SettingsViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Maps live Android signals into [MeshPlatformStateMachine] events (ADIM 30).
 * Call [refresh] on resume and after permission/BT/network changes.
 */
@Singleton
class MeshPlatformSignalBridge
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val permissionFlowCoordinator: PermissionFlowCoordinator,
        private val relaySettings: RelaySettingsStore,
        private val batteryReader: RelayBatterySnapshotReader,
        private val bluetoothEnabled: () -> Boolean,
    ) {
        private val machine = MeshPlatformStateMachine()

        @Volatile private var lastTransferCorrupt: Boolean = false
        @Volatile private var lastApiUploadFailed: Boolean = false

        fun noteTransferCorrupt() {
            lastTransferCorrupt = true
        }

        fun noteApiUploadFailed() {
            lastApiUploadFailed = true
        }

        fun clearCrossPlatformFaultFlags() {
            lastTransferCorrupt = false
            lastApiUploadFailed = false
        }

        fun lastTransferCorruptFlag(): Boolean = lastTransferCorrupt

        fun lastApiUploadFailedFlag(): Boolean = lastApiUploadFailed

        fun locationServicesAvailable(): Boolean {
            val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        }

        fun refresh(nowMs: Long = System.currentTimeMillis()): MeshPlatformEvaluation {
            val snapshot = readSnapshot()
            val events = diffEvents(machine.currentState(), snapshot)
            var evaluation = machine.currentEvaluation()
            events.forEach { evaluation = machine.reduce(it) }
            return evaluation
        }

        fun currentEvaluation(): MeshPlatformEvaluation = machine.currentEvaluation()

        fun notifySosTransferActive(active: Boolean) {
            if (active) {
                machine.reduce(MeshPlatformEvent.SosTransferStarted)
            } else {
                machine.reduce(MeshPlatformEvent.SosTransferEnded)
            }
        }

        private fun readSnapshot(): MeshPlatformState {
            val battery = batteryReader.read()
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val uiPrefs = context.getSharedPreferences(SettingsViewModel.PREFS_NAME, Context.MODE_PRIVATE)
            return MeshPlatformState(
                networkValidated = networkValidated(),
                bluetoothEnabled = bluetoothEnabled(),
                blePermissionsGranted = permissionFlowCoordinator.allGranted(),
                batteryLevelPercent = battery.levelPercent,
                relayOptIn = relaySettings.isRelayEnabled(),
                powerSaveEnabled = pm.isPowerSaveMode,
                deviceIdle = pm.isDeviceIdleMode,
                thermalThrottled = thermalThrottled(pm),
                highPowerRadioConsent =
                    uiPrefs.getBoolean(SettingsViewModel.KEY_HIGH_POWER_RADIO_CONSENT, false),
                sosTransferActive = machine.currentState().sosTransferActive,
            )
        }

        private fun thermalThrottled(pm: PowerManager): Boolean {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                return false
            }
            return pm.currentThermalStatus >= PowerManager.THERMAL_STATUS_MODERATE
        }

        private fun networkValidated(): Boolean {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        }

        private fun diffEvents(
            previous: MeshPlatformState,
            next: MeshPlatformState,
        ): List<MeshPlatformEvent> {
            val events = mutableListOf<MeshPlatformEvent>()
            if (previous.networkValidated != next.networkValidated) {
                events +=
                    if (next.networkValidated) {
                        MeshPlatformEvent.NetworkAvailable
                    } else {
                        MeshPlatformEvent.NetworkLost
                    }
            }
            if (previous.bluetoothEnabled != next.bluetoothEnabled) {
                events +=
                    if (next.bluetoothEnabled) {
                        MeshPlatformEvent.BluetoothEnabled
                    } else {
                        MeshPlatformEvent.BluetoothDisabled
                    }
            }
            if (previous.blePermissionsGranted != next.blePermissionsGranted) {
                events +=
                    if (next.blePermissionsGranted) {
                        MeshPlatformEvent.BlePermissionsGranted
                    } else {
                        MeshPlatformEvent.BlePermissionsDenied
                    }
            }
            if (previous.batteryLevelPercent != next.batteryLevelPercent) {
                events += MeshPlatformEvent.BatteryLevelChanged(next.batteryLevelPercent)
            }
            if (previous.powerSaveEnabled != next.powerSaveEnabled) {
                events +=
                    if (next.powerSaveEnabled) {
                        MeshPlatformEvent.PowerSaveEnabled
                    } else {
                        MeshPlatformEvent.PowerSaveDisabled
                    }
            }
            if (previous.deviceIdle != next.deviceIdle) {
                events +=
                    if (next.deviceIdle) {
                        MeshPlatformEvent.DeviceIdleEnter
                    } else {
                        MeshPlatformEvent.DeviceIdleExit
                    }
            }
            if (previous.relayOptIn != next.relayOptIn) {
                events +=
                    if (next.relayOptIn) {
                        MeshPlatformEvent.RelayOptIn
                    } else {
                        MeshPlatformEvent.RelayOptOut
                    }
            }
            if (previous.thermalThrottled != next.thermalThrottled) {
                events +=
                    if (next.thermalThrottled) {
                        MeshPlatformEvent.ThermalThrottled
                    } else {
                        MeshPlatformEvent.ThermalNormal
                    }
            }
            if (previous.highPowerRadioConsent != next.highPowerRadioConsent) {
                events +=
                    if (next.highPowerRadioConsent) {
                        MeshPlatformEvent.HighPowerRadioConsentGranted
                    } else {
                        MeshPlatformEvent.HighPowerRadioConsentRevoked
                    }
            }
            return events
        }
    }
