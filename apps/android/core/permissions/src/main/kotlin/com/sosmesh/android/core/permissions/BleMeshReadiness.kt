package com.sosmesh.android.core.permissions

import android.os.Build
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BleMeshReadiness
    @Inject
    constructor(
        private val permissionFlowCoordinator: PermissionFlowCoordinator,
        private val bluetoothEnabledProbe: BluetoothEnabledProbe,
        private val locationServicesProbe: LocationServicesProbe,
    ) {
        fun canRunBleMeshFeatures(): Boolean {
            val evaluation =
                PermissionGateEvaluator.evaluate(
                    sdkInt = Build.VERSION.SDK_INT,
                    missingRuntimePermissions = permissionFlowCoordinator.missingPermissions(),
                    bluetoothEnabled = bluetoothEnabledProbe.isBluetoothEnabled(),
                    locationServicesEnabled = locationServicesProbe.locationServicesAvailable(),
                )
            return evaluation.canEnterApp
        }
    }
