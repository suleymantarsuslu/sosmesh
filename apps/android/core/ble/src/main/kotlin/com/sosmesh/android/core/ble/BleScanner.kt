package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.BleScannerPort
import com.sosmesh.android.core.ble.platform.ScanCallbackPort
import com.sosmesh.android.core.ble.platform.ScanRequest

class BleScanner(
    private val scannerPort: BleScannerPort,
    private val guard: PermissionAndAdapterGuard,
    private val onPeerAdvertisement: (manufacturerPayload: ByteArray?) -> Unit,
) : ScanCallbackPort {
    private var scanning: Boolean = false

    fun start(foregroundVisible: Boolean): Result<Unit> {
        when (val verdict = guard.evaluateForScan()) {
            is GuardVerdict.Blocked -> return Result.failure(verdict.error)
            GuardVerdict.Ready -> Unit
        }
        val scanMode =
            if (foregroundVisible) {
                BleScanProfile.FOREGROUND_LOW_POWER_SCAN_MODE
            } else {
                BleScanProfile.BACKGROUND_BALANCED_SCAN_MODE
            }
        val request =
            ScanRequest(
                serviceUuid = BleMeshConstants.SERVICE_UUID,
                scanMode = scanMode,
                reportDelayMillis = BleScanProfile.FOREGROUND_SCAN_PERIOD_MS,
            )
        val started = scannerPort.startScan(request, this)
        scanning = started.isSuccess
        return started
    }

    fun stop() {
        if (scanning) {
            scannerPort.stopScan()
            scanning = false
        }
    }

    fun isScanning(): Boolean = scanning

    override fun onScanResult(
        serviceUuid: String,
        manufacturerPayload: ByteArray?,
    ) {
        if (serviceUuid.equals(BleMeshConstants.SERVICE_UUID, ignoreCase = true)) {
            onPeerAdvertisement(manufacturerPayload)
        }
    }
}
