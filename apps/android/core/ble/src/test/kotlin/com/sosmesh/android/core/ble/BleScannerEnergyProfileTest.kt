package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.BleScannerPort
import com.sosmesh.android.core.ble.platform.BluetoothAdapterPort
import com.sosmesh.android.core.ble.platform.LocationServicesPort
import com.sosmesh.android.core.ble.platform.ScanCallbackPort
import com.sosmesh.android.core.ble.platform.ScanRequest
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import com.sosmesh.android.core.platform.EnergyRadioProfile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BleScannerEnergyProfileTest {
    private class GrantReader : PermissionStatusReader {
        override fun isGranted(permission: String): Boolean = true

        override fun shouldShowRationale(permission: String): Boolean = false
    }

    private class FakeAdapter(
        private val enabled: Boolean,
    ) : BluetoothAdapterPort {
        override fun isEnabled(): Boolean = enabled
    }

    private class FakeLocation : LocationServicesPort {
        override fun isEnabledForBleScan(): Boolean = true
    }

    private class RecordingScanner : BleScannerPort {
        var lastRequest: ScanRequest? = null
        var startCount: Int = 0

        override fun startScan(
            request: ScanRequest,
            callback: ScanCallbackPort,
        ): Result<Unit> {
            lastRequest = request
            startCount++
            return Result.success(Unit)
        }

        override fun stopScan() {
            lastRequest = null
        }
    }

    private fun scannerWithReadyGuard(recording: RecordingScanner): BleScanner {
        val guard =
            PermissionAndAdapterGuard(
                sdkInt = 31,
                permissionFlowCoordinator = PermissionFlowCoordinator(31, GrantReader()),
                bluetoothAdapter = FakeAdapter(enabled = true),
                locationServices = FakeLocation(),
            )
        return BleScanner(recording, guard) {}
    }

    @Test
    fun blockedProfile_doesNotStartScan() {
        val recording = RecordingScanner()
        val scanner = scannerWithReadyGuard(recording)
        val result = scanner.start(EnergyRadioProfile.BLOCKED)
        assertTrue(result.isFailure)
        assertEquals(0, recording.startCount)
    }

    @Test
    fun sosUrgentProfile_passesLowLatencyModeToScannerPort() {
        val recording = RecordingScanner()
        val scanner = scannerWithReadyGuard(recording)
        val result = scanner.start(EnergyRadioProfile.SOS_URGENT)
        assertTrue(result.isSuccess)
        assertEquals(EnergyRadioProfile.SCAN_MODE_LOW_LATENCY, recording.lastRequest!!.scanMode)
        assertEquals(EnergyRadioProfile.SOS_URGENT.scanPeriodMs, recording.lastRequest!!.reportDelayMillis)
        assertTrue(
            EnergyRadioProfile.SOS_URGENT.scanPeriodMs <
                EnergyRadioProfile.RELAY_FOREGROUND_LOW_POWER.scanPeriodMs,
        )
    }

    @Test
    fun constrainedProfile_usesLongerScanPeriodThanSosUrgent() {
        val recording = RecordingScanner()
        val scanner = scannerWithReadyGuard(recording)
        scanner.start(EnergyRadioProfile.SOS_URGENT)
        val urgentPeriod = recording.lastRequest!!.reportDelayMillis
        scanner.stop()
        scanner.start(EnergyRadioProfile.CONSTRAINED)
        assertTrue(recording.lastRequest!!.reportDelayMillis > urgentPeriod)
        assertEquals(EnergyRadioProfile.SCAN_MODE_LOW_POWER, recording.lastRequest!!.scanMode)
    }
}
