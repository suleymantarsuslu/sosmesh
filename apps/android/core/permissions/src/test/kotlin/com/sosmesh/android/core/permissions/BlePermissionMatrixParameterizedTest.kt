package com.sosmesh.android.core.permissions

import android.Manifest
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(ParameterizedRobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class BlePermissionMatrixParameterizedTest(
    private val sdkInt: Int,
    private val expected: Set<String>,
) {
    @Test
    fun requiredRuntimePermissions_matchesExpectedSetExactly() {
        val actual = BlePermissionMatrix.requiredRuntimePermissions(sdkInt).permissions
        assertEquals(expected, actual)
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "sdk={0}")
        fun data(): Collection<Array<Any>> =
            listOf(
                arrayOf(
                    26,
                    setOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                        Manifest.permission.BLUETOOTH,
                        Manifest.permission.BLUETOOTH_ADMIN,
                    ),
                ),
                arrayOf(
                    30,
                    setOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                        Manifest.permission.BLUETOOTH,
                        Manifest.permission.BLUETOOTH_ADMIN,
                    ),
                ),
                arrayOf(
                    31,
                    setOf(
                        Manifest.permission.BLUETOOTH_SCAN,
                        Manifest.permission.BLUETOOTH_CONNECT,
                        Manifest.permission.BLUETOOTH_ADVERTISE,
                    ),
                ),
                arrayOf(
                    33,
                    setOf(
                        Manifest.permission.BLUETOOTH_SCAN,
                        Manifest.permission.BLUETOOTH_CONNECT,
                        Manifest.permission.BLUETOOTH_ADVERTISE,
                        Manifest.permission.POST_NOTIFICATIONS,
                    ),
                ),
                arrayOf(
                    34,
                    setOf(
                        Manifest.permission.BLUETOOTH_SCAN,
                        Manifest.permission.BLUETOOTH_CONNECT,
                        Manifest.permission.BLUETOOTH_ADVERTISE,
                        Manifest.permission.POST_NOTIFICATIONS,
                        Manifest.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE,
                    ),
                ),
                arrayOf(
                    35,
                    setOf(
                        Manifest.permission.BLUETOOTH_SCAN,
                        Manifest.permission.BLUETOOTH_CONNECT,
                        Manifest.permission.BLUETOOTH_ADVERTISE,
                        Manifest.permission.POST_NOTIFICATIONS,
                        Manifest.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE,
                    ),
                ),
                arrayOf(
                    36,
                    setOf(
                        Manifest.permission.BLUETOOTH_SCAN,
                        Manifest.permission.BLUETOOTH_CONNECT,
                        Manifest.permission.BLUETOOTH_ADVERTISE,
                        Manifest.permission.POST_NOTIFICATIONS,
                        Manifest.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE,
                    ),
                ),
            )
    }
}
