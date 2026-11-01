package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.AdvertiseRequest
import com.sosmesh.android.core.ble.platform.BleAdvertiserPort
import com.sosmesh.android.core.ble.platform.BluetoothAdapterPort
import com.sosmesh.android.core.ble.platform.LocationServicesPort
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.permissions.PermissionStatusReader
import com.sosmesh.ble.BleProtocol
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class BleAdvertiserPayloadTest {
    private class AllowAllReader : PermissionStatusReader {
        override fun isGranted(permission: String): Boolean = true

        override fun shouldShowRationale(permission: String): Boolean = false
    }

    private class FakeAdapter : BluetoothAdapterPort {
        override fun isEnabled(): Boolean = true
    }

    private class FakeLocation : LocationServicesPort {
        override fun isEnabledForBleScan(): Boolean = true
    }

    private class CapturingAdvertiser : BleAdvertiserPort {
        var lastRequest: AdvertiseRequest? = null

        override fun startAdvertising(request: AdvertiseRequest): Result<Unit> {
            lastRequest = request
            return Result.success(Unit)
        }

        override fun stopAdvertising() = Unit
    }

    @Test
    fun advertisePayload_excludesDeviceNameAndMacPatterns() {
        val guard =
            PermissionAndAdapterGuard(
                sdkInt = 31,
                permissionFlowCoordinator = PermissionFlowCoordinator(31, AllowAllReader()),
                bluetoothAdapter = FakeAdapter(),
                locationServices = FakeLocation(),
            )
        val advertiser =
            BleAdvertiser(
                CapturingAdvertiser(),
                guard,
                EphemeralIdGenerator(
                    clock =
                        object : Clock {
                            override fun currentTimeMillis(): Long = 0L
                        },
                ),
            )
        val request = advertiser.buildAdvertiseRequest()
        assertFalse(request.includeDeviceName)
        assertEquals(BleMeshConstants.MANUFACTURER_COMPANY_ID, request.manufacturerCompanyId)
        assertEquals(5, request.manufacturerPayload.size)
        assertEquals(BleProtocol.PROTOCOL_VERSION, request.manufacturerPayload[0])
        val opaque = request.manufacturerPayload.copyOfRange(1, 5)
        assertEquals(4, opaque.size)
        assertFalse(String(opaque, Charsets.US_ASCII).contains(":"))
    }
}
