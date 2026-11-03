package com.sosmesh.android.core.permissions

import android.Manifest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PermissionGateEvaluatorTest {
    @Test
    fun allGranted_bluetoothOn_readyOnApi31() {
        val evaluation =
            PermissionGateEvaluator.evaluate(
                sdkInt = 31,
                missingRuntimePermissions = emptyList(),
                bluetoothEnabled = true,
                locationServicesEnabled = false,
            )
        assertTrue(evaluation.canEnterApp)
        assertEquals(null, evaluation.primaryBlocker())
    }

    @Test
    fun missingScan_blocksBeforeBluetooth() {
        val evaluation =
            PermissionGateEvaluator.evaluate(
                sdkInt = 31,
                missingRuntimePermissions = listOf(Manifest.permission.BLUETOOTH_SCAN),
                bluetoothEnabled = true,
                locationServicesEnabled = true,
            )
        assertFalse(evaluation.canEnterApp)
        val blocker = evaluation.primaryBlocker()
        assertTrue(blocker is PermissionGateEvaluator.PermissionGateBlocker.RuntimePermissions)
    }

    @Test
    fun permissionsOk_bluetoothOff_blocksOnBluetooth() {
        val evaluation =
            PermissionGateEvaluator.evaluate(
                sdkInt = 33,
                missingRuntimePermissions = emptyList(),
                bluetoothEnabled = false,
                locationServicesEnabled = true,
            )
        assertFalse(evaluation.canEnterApp)
        assertTrue(
            evaluation.primaryBlocker() is PermissionGateEvaluator.PermissionGateBlocker.BluetoothDisabled,
        )
    }

    @Test
    fun api30_requiresLocationServicesWhenPermissionsGranted() {
        val evaluation =
            PermissionGateEvaluator.evaluate(
                sdkInt = 30,
                missingRuntimePermissions = emptyList(),
                bluetoothEnabled = true,
                locationServicesEnabled = false,
            )
        assertFalse(evaluation.canEnterApp)
        assertTrue(
            evaluation.primaryBlocker() is PermissionGateEvaluator.PermissionGateBlocker.LocationServicesDisabled,
        )
    }

    @Test
    fun permanentDenial_surfacesSettingsRequired() {
        val evaluation =
            PermissionGateEvaluator.evaluate(
                sdkInt = 31,
                missingRuntimePermissions = listOf(Manifest.permission.BLUETOOTH_CONNECT),
                bluetoothEnabled = true,
                locationServicesEnabled = true,
                permanentlyDeniedPermissions = setOf(Manifest.permission.BLUETOOTH_CONNECT),
            )
        val blocker = evaluation.primaryBlocker() as PermissionGateEvaluator.PermissionGateBlocker.RuntimePermissions
        assertTrue(blocker.settingsRequired)
    }
}
