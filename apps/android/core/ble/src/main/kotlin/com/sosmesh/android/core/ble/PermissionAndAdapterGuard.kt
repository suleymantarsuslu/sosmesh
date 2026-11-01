package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.BluetoothAdapterPort
import com.sosmesh.android.core.ble.platform.LocationServicesPort
import com.sosmesh.android.core.permissions.BlePermissionMatrix
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator

sealed class GuardVerdict {
    data object Ready : GuardVerdict()

    data class Blocked(
        val error: BleRadioError,
    ) : GuardVerdict()
}

/**
 * Validates Bluetooth adapter, runtime permissions (ADIM 12 matrix), and location services when required.
 */
class PermissionAndAdapterGuard(
    private val sdkInt: Int,
    private val permissionFlowCoordinator: PermissionFlowCoordinator,
    private val bluetoothAdapter: BluetoothAdapterPort,
    private val locationServices: LocationServicesPort,
) {
    fun evaluateForScan(): GuardVerdict {
        if (!bluetoothAdapter.isEnabled()) {
            return GuardVerdict.Blocked(BleRadioError.BluetoothDisabled())
        }
        if (!permissionFlowCoordinator.allGranted()) {
            val missing = permissionFlowCoordinator.missingPermissions()
            return GuardVerdict.Blocked(BleRadioError.PermissionsMissing(missing))
        }
        if (requiresLocationServices() && !locationServices.isEnabledForBleScan()) {
            return GuardVerdict.Blocked(BleRadioError.LocationServicesDisabled())
        }
        return GuardVerdict.Ready
    }

    fun evaluateForAdvertise(): GuardVerdict {
        if (!bluetoothAdapter.isEnabled()) {
            return GuardVerdict.Blocked(BleRadioError.BluetoothDisabled())
        }
        if (!permissionFlowCoordinator.allGranted()) {
            val missing = permissionFlowCoordinator.missingPermissions()
            return GuardVerdict.Blocked(BleRadioError.PermissionsMissing(missing))
        }
        return GuardVerdict.Ready
    }

    private fun requiresLocationServices(): Boolean {
        val runtime = BlePermissionMatrix.runtimePermissions(sdkInt).permissions
        return runtime.contains(android.Manifest.permission.ACCESS_FINE_LOCATION) ||
            runtime.contains(android.Manifest.permission.ACCESS_COARSE_LOCATION)
    }
}
