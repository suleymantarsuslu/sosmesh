package com.sosmesh.android.core.permissions

import android.Manifest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PermissionFlowCoordinatorTest {
    private class FakeReader(
        initialGranted: Set<String> = emptySet(),
        initialRationale: Set<String> = emptySet(),
    ) : PermissionStatusReader {
        val granted = initialGranted.toMutableSet()
        private val rationale = initialRationale.toMutableSet()

        override fun isGranted(permission: String): Boolean = granted.contains(permission)

        override fun shouldShowRationale(permission: String): Boolean = rationale.contains(permission)
    }

    @Test
    fun grantPath_clearsMissingList() {
        val reader = FakeReader(initialGranted = setOf(Manifest.permission.BLUETOOTH_SCAN))
        val coordinator = PermissionFlowCoordinator(sdkInt = 31, reader)
        assertTrue(coordinator.allGranted().not())
        reader.granted.addAll(
            listOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_ADVERTISE,
            ),
        )
        assertTrue(coordinator.allGranted())
    }

    @Test
    fun denyWithRationale_canRetry() {
        val reader = FakeReader(initialRationale = setOf(Manifest.permission.BLUETOOTH_SCAN))
        val coordinator = PermissionFlowCoordinator(sdkInt = 31, reader)
        val outcome =
            coordinator.classifyOutcome(
                Manifest.permission.BLUETOOTH_SCAN,
                mapOf(Manifest.permission.BLUETOOTH_SCAN to android.content.pm.PackageManager.PERMISSION_DENIED),
            )
        assertEquals(PermissionRequestOutcome.DENIED_CAN_RETRY, outcome)
    }

    @Test
    fun permanentlyDenied_whenNoRationale() {
        val reader = FakeReader()
        val coordinator = PermissionFlowCoordinator(sdkInt = 31, reader)
        val outcome =
            coordinator.classifyOutcome(
                Manifest.permission.BLUETOOTH_SCAN,
                mapOf(Manifest.permission.BLUETOOTH_SCAN to android.content.pm.PackageManager.PERMISSION_DENIED),
            )
        assertEquals(PermissionRequestOutcome.PERMANENTLY_DENIED, outcome)
    }

    @Test
    fun settingsIntentAction_isApplicationDetails() {
        val reader = FakeReader()
        val coordinator = PermissionFlowCoordinator(sdkInt = 31, reader)
        assertFalse(coordinator.allGranted())
        assertEquals(Manifest.permission.BLUETOOTH_SCAN, coordinator.nextMissingPermission())
    }
}
