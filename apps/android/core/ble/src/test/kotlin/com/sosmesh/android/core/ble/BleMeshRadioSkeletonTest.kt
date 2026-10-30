package com.sosmesh.android.core.ble

import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import org.junit.Assert.assertTrue
import org.junit.Test

class BleMeshRadioSkeletonTest {
    private class DenyAllReader : PermissionStatusReader {
        override fun isGranted(permission: String): Boolean = false

        override fun shouldShowRationale(permission: String): Boolean = false
    }

    @Test
    fun startScan_withoutPermissions_fails() {
        val coordinator = PermissionFlowCoordinator(sdkInt = 31, DenyAllReader())
        val radio = BleMeshRadioSkeleton(coordinator)
        val result = radio.startScan()
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is MissingBlePermissionsException)
    }
}
