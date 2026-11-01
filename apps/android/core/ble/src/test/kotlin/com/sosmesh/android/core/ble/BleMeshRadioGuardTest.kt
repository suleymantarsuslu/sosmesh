package com.sosmesh.android.core.ble

import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import org.junit.Assert.assertTrue
import org.junit.Test

class BleMeshRadioGuardTest {
    private class DenyAllReader : PermissionStatusReader {
        override fun isGranted(permission: String): Boolean = false

        override fun shouldShowRationale(permission: String): Boolean = false
    }

    @Test
    fun guard_permissionsMissing_isTypedError() {
        val coordinator = PermissionFlowCoordinator(sdkInt = 31, DenyAllReader())
        val verdict =
            PermissionAndAdapterGuard(
                sdkInt = 31,
                permissionFlowCoordinator = coordinator,
                bluetoothAdapter = { true },
                locationServices = { true },
            ).evaluateForScan()
        assertTrue(verdict is GuardVerdict.Blocked)
        assertTrue((verdict as GuardVerdict.Blocked).error is BleRadioError.PermissionsMissing)
    }
}

private fun PermissionAndAdapterGuard(
    sdkInt: Int,
    permissionFlowCoordinator: PermissionFlowCoordinator,
    bluetoothAdapter: () -> Boolean,
    locationServices: () -> Boolean,
): PermissionAndAdapterGuard =
    PermissionAndAdapterGuard(
        sdkInt = sdkInt,
        permissionFlowCoordinator = permissionFlowCoordinator,
        bluetoothAdapter =
            object : com.sosmesh.android.core.ble.platform.BluetoothAdapterPort {
                override fun isEnabled(): Boolean = bluetoothAdapter()
            },
        locationServices =
            object : com.sosmesh.android.core.ble.platform.LocationServicesPort {
                override fun isEnabledForBleScan(): Boolean = locationServices()
            },
    )
