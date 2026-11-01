package com.sosmesh.android.core.permissions

import android.Manifest
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(ParameterizedRobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class RuntimePermissionsParameterizedTest(
    private val sdkInt: Int,
    private val expectedRuntime: Set<String>,
) {
    @Test
    fun runtimePermissions_matchesExpectedSetExactly() {
        val actual = BlePermissionMatrix.runtimePermissions(sdkInt).permissions
        assertEquals(expectedRuntime, actual)
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "runtime sdk={0}")
        fun data(): Collection<Array<Any>> =
            listOf(
                arrayOf(
                    26,
                    setOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    ),
                ),
                arrayOf(
                    30,
                    setOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
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
                    ),
                ),
                arrayOf(
                    35,
                    setOf(
                        Manifest.permission.BLUETOOTH_SCAN,
                        Manifest.permission.BLUETOOTH_CONNECT,
                        Manifest.permission.BLUETOOTH_ADVERTISE,
                        Manifest.permission.POST_NOTIFICATIONS,
                    ),
                ),
                arrayOf(
                    36,
                    setOf(
                        Manifest.permission.BLUETOOTH_SCAN,
                        Manifest.permission.BLUETOOTH_CONNECT,
                        Manifest.permission.BLUETOOTH_ADVERTISE,
                        Manifest.permission.POST_NOTIFICATIONS,
                    ),
                ),
            )
    }
}

@RunWith(ParameterizedRobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class ManifestPermissionsParameterizedTest(
    private val sdkInt: Int,
    private val expectedManifest: Set<String>,
) {
    @Test
    fun manifestPermissions_matchesExpectedSetExactly() {
        val actual = BlePermissionMatrix.manifestPermissions(sdkInt).permissions
        assertEquals(expectedManifest, actual)
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "manifest sdk={0}")
        fun data(): Collection<Array<Any>> =
            listOf(
                arrayOf(
                    26,
                    setOf(
                        Manifest.permission.BLUETOOTH,
                        Manifest.permission.BLUETOOTH_ADMIN,
                        Manifest.permission.INTERNET,
                        Manifest.permission.ACCESS_NETWORK_STATE,
                    ),
                ),
                arrayOf(
                    30,
                    setOf(
                        Manifest.permission.BLUETOOTH,
                        Manifest.permission.BLUETOOTH_ADMIN,
                        Manifest.permission.FOREGROUND_SERVICE,
                        Manifest.permission.INTERNET,
                        Manifest.permission.ACCESS_NETWORK_STATE,
                    ),
                ),
                arrayOf(
                    31,
                    setOf(
                        Manifest.permission.FOREGROUND_SERVICE,
                        Manifest.permission.INTERNET,
                        Manifest.permission.ACCESS_NETWORK_STATE,
                    ),
                ),
                arrayOf(
                    33,
                    setOf(
                        Manifest.permission.FOREGROUND_SERVICE,
                        Manifest.permission.INTERNET,
                        Manifest.permission.ACCESS_NETWORK_STATE,
                    ),
                ),
                arrayOf(
                    34,
                    setOf(
                        Manifest.permission.FOREGROUND_SERVICE,
                        Manifest.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE,
                        Manifest.permission.INTERNET,
                        Manifest.permission.ACCESS_NETWORK_STATE,
                    ),
                ),
                arrayOf(
                    35,
                    setOf(
                        Manifest.permission.FOREGROUND_SERVICE,
                        Manifest.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE,
                        Manifest.permission.INTERNET,
                        Manifest.permission.ACCESS_NETWORK_STATE,
                    ),
                ),
                arrayOf(
                    36,
                    setOf(
                        Manifest.permission.FOREGROUND_SERVICE,
                        Manifest.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE,
                        Manifest.permission.INTERNET,
                        Manifest.permission.ACCESS_NETWORK_STATE,
                    ),
                ),
            )
    }
}
