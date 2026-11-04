package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.AdvertiseRequest
import com.sosmesh.android.core.ble.platform.BleAdvertiserPort

class BleAdvertiser(
    private val advertiserPort: BleAdvertiserPort,
    private val guard: PermissionAndAdapterGuard,
    private val ephemeralIdGenerator: EphemeralIdGenerator,
) {
    fun buildAdvertiseRequest(): AdvertiseRequest {
        val payload = ephemeralIdGenerator.manufacturerPayload()
        return AdvertiseRequest(
            serviceUuid = BleMeshConstants.SERVICE_UUID,
            manufacturerCompanyId = BleMeshConstants.MANUFACTURER_COMPANY_ID,
            manufacturerPayload = payload,
            includeDeviceName = false,
            serviceData = MeshV2Hooks.hooks?.advertisementServiceData(System.currentTimeMillis()) ?: ByteArray(0),
        )
    }

    fun start(): Result<Unit> {
        when (val verdict = guard.evaluateForAdvertise()) {
            is GuardVerdict.Blocked -> return Result.failure(verdict.error)
            GuardVerdict.Ready -> Unit
        }
        return advertiserPort.startAdvertising(buildAdvertiseRequest())
    }

    fun stop() {
        advertiserPort.stopAdvertising()
    }
}
