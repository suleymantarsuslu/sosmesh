package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.BleScannerPort
import com.sosmesh.android.core.ble.platform.BluetoothAdapterPort
import com.sosmesh.android.core.ble.platform.LocationServicesPort
import com.sosmesh.android.core.ble.platform.ScanCallbackPort
import com.sosmesh.android.core.ble.platform.ScanRequest
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import org.junit.Assert.assertTrue
import org.junit.Test

class PermissionAndAdapterGuardTest {
    private class DenyReader : PermissionStatusReader {
        override fun isGranted(permission: String): Boolean = false

        override fun shouldShowRationale(permission: String): Boolean = false
    }

    private class FakeAdapter(
        private val enabled: Boolean,
    ) : BluetoothAdapterPort {
        override fun isEnabled(): Boolean = enabled
    }

    private class FakeLocation(
        private val enabled: Boolean,
    ) : LocationServicesPort {
        override fun isEnabledForBleScan(): Boolean = enabled
    }

    private class RecordingScanner : BleScannerPort {
        var started: Boolean = false

        override fun startScan(
            request: ScanRequest,
            callback: ScanCallbackPort,
        ): Result<Unit> {
            started = true
            return Result.success(Unit)
        }

        override fun stopScan() {
            started = false
        }
    }

    @Test
    fun bluetoothOff_blocksScanStart() {
        val guard =
            PermissionAndAdapterGuard(
                sdkInt = 31,
                permissionFlowCoordinator = PermissionFlowCoordinator(31, DenyReader()),
                bluetoothAdapter = FakeAdapter(enabled = false),
                locationServices = FakeLocation(enabled = true),
            )
        val scanner = BleScanner(RecordingScanner(), guard) {}
        val result = scanner.start(foregroundVisible = true)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is BleRadioError.BluetoothDisabled)
    }

    @Test
    fun permissionsMissing_blocksScanStart() {
        val guard =
            PermissionAndAdapterGuard(
                sdkInt = 31,
                permissionFlowCoordinator = PermissionFlowCoordinator(31, DenyReader()),
                bluetoothAdapter = FakeAdapter(enabled = true),
                locationServices = FakeLocation(enabled = true),
            )
        val recording = RecordingScanner()
        val scanner = BleScanner(recording, guard) {}
        val result = scanner.start(foregroundVisible = true)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is BleRadioError.PermissionsMissing)
        assertTrue(!recording.started)
    }
}
