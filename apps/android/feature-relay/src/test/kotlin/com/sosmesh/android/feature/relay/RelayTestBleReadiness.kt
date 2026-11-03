package com.sosmesh.android.feature.relay

import com.sosmesh.android.core.permissions.BleMeshReadiness
import com.sosmesh.android.core.permissions.BluetoothEnabledProbe
import com.sosmesh.android.core.permissions.LocationServicesProbe
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers

internal fun testGrantAllPermissionCoordinator(): PermissionFlowCoordinator =
    PermissionFlowCoordinator(
        sdkInt = 33,
        statusReader =
            object : PermissionStatusReader {
                override fun isGranted(permission: String): Boolean = true

                override fun shouldShowRationale(permission: String): Boolean = false
            },
    )

internal fun testBleMeshReadiness(permissionFlowCoordinator: PermissionFlowCoordinator): BleMeshReadiness =
    BleMeshReadiness(
        permissionFlowCoordinator = permissionFlowCoordinator,
        bluetoothEnabledProbe =
            object : BluetoothEnabledProbe {
                override fun isBluetoothEnabled(): Boolean = true
            },
        locationServicesProbe =
            object : LocationServicesProbe {
                override fun locationServicesAvailable(): Boolean = true
            },
    )

internal fun testGrantAllBleMeshReadiness(): BleMeshReadiness = testBleMeshReadiness(testGrantAllPermissionCoordinator())

internal fun testIoDispatcher(): CoroutineDispatcher = Dispatchers.Unconfined
