package com.sosmesh.android.core.ble

import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BleMeshRadioSkeleton
    @Inject
    constructor(
        private val permissionFlowCoordinator: PermissionFlowCoordinator,
    ) : BleMeshRadio {
        override fun startScan(): Result<Unit> {
            if (!permissionFlowCoordinator.allGranted()) {
                return Result.failure(MissingBlePermissionsException())
            }
            return Result.success(Unit)
        }

        override fun stopScan() {
            // ADIM 14: stop Android BLE scanner.
        }
    }
