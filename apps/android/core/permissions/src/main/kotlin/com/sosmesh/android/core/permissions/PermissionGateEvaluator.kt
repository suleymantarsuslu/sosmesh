package com.sosmesh.android.core.permissions

/**
 * Pure gate logic for startup onboarding (runtime permissions + Bluetooth + location services when required).
 */
object PermissionGateEvaluator {
    data class PermissionGateEvaluation(
        val canEnterApp: Boolean,
        val missingRuntimePermissions: List<String>,
        val bluetoothEnabled: Boolean,
        val locationServicesRequired: Boolean,
        val locationServicesEnabled: Boolean,
        val permanentlyDeniedPermissions: Set<String>,
    ) {
        val needsBluetoothEnable: Boolean get() = !bluetoothEnabled

        val needsLocationServices: Boolean get() = locationServicesRequired && !locationServicesEnabled

        val needsRuntimePermissions: Boolean get() = missingRuntimePermissions.isNotEmpty()

        fun primaryBlocker(): PermissionGateBlocker? =
            when {
                needsRuntimePermissions ->
                    PermissionGateBlocker.RuntimePermissions(
                        missing = missingRuntimePermissions,
                        settingsRequired = missingRuntimePermissions.any { it in permanentlyDeniedPermissions },
                    )
                needsBluetoothEnable -> PermissionGateBlocker.BluetoothDisabled
                needsLocationServices -> PermissionGateBlocker.LocationServicesDisabled
                else -> null
            }
    }

    sealed class PermissionGateBlocker {
        data class RuntimePermissions(
            val missing: List<String>,
            val settingsRequired: Boolean,
        ) : PermissionGateBlocker()

        data object BluetoothDisabled : PermissionGateBlocker()

        data object LocationServicesDisabled : PermissionGateBlocker()
    }

    fun evaluate(
        sdkInt: Int,
        missingRuntimePermissions: List<String>,
        bluetoothEnabled: Boolean,
        locationServicesEnabled: Boolean,
        permanentlyDeniedPermissions: Set<String> = emptySet(),
    ): PermissionGateEvaluation {
        val locationRequired = requiresLocationServicesForBle(sdkInt)
        val canEnter =
            missingRuntimePermissions.isEmpty() &&
                bluetoothEnabled &&
                (!locationRequired || locationServicesEnabled)
        return PermissionGateEvaluation(
            canEnterApp = canEnter,
            missingRuntimePermissions = missingRuntimePermissions,
            bluetoothEnabled = bluetoothEnabled,
            locationServicesRequired = locationRequired,
            locationServicesEnabled = locationServicesEnabled,
            permanentlyDeniedPermissions = permanentlyDeniedPermissions,
        )
    }

    fun requiresLocationServicesForBle(sdkInt: Int): Boolean {
        val runtime = BlePermissionMatrix.runtimePermissions(sdkInt).permissions
        return runtime.contains(android.Manifest.permission.ACCESS_FINE_LOCATION) ||
            runtime.contains(android.Manifest.permission.ACCESS_COARSE_LOCATION)
    }
}
