package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.BleScannerPort
import com.sosmesh.android.core.ble.platform.ScanCallbackPort
import com.sosmesh.android.core.ble.platform.ScanRequest
import com.sosmesh.android.core.platform.EnergyRadioProfile

class BleScanner(
    private val scannerPort: BleScannerPort,
    private val guard: PermissionAndAdapterGuard,
    private val onSighting: ((address: String, rssi: Int, manufacturerPayload: ByteArray?, h: Int) -> Unit)? = null,
    private val onPeerAdvertisement: (manufacturerPayload: ByteArray?) -> Unit,
) : ScanCallbackPort {
    override fun onPeerSighting(
        address: String,
        rssi: Int,
        manufacturerPayload: ByteArray?,
        h: Int,
    ) {
        val sink = onSighting
        if (sink != null) sink(address, rssi, manufacturerPayload, h) else onPeerAdvertisement(manufacturerPayload)
    }

    private var scanning: Boolean = false

    fun start(foregroundVisible: Boolean): Result<Unit> {
        val profile =
            if (foregroundVisible) {
                EnergyRadioProfile.RELAY_FOREGROUND_LOW_POWER
            } else {
                EnergyRadioProfile(
                    scanMode = BleScanProfile.BACKGROUND_BALANCED_SCAN_MODE,
                    scanPeriodMs = BleScanProfile.FOREGROUND_SCAN_PERIOD_MS,
                    scanPauseMs = BleScanProfile.FOREGROUND_SCAN_PAUSE_MS,
                    scanningAllowed = true,
                )
            }
        return start(profile)
    }

    fun start(radioProfile: EnergyRadioProfile): Result<Unit> {
        if (!radioProfile.scanningAllowed) {
            return Result.failure(BleRadioError.BluetoothDisabled())
        }
        when (val verdict = guard.evaluateForScan()) {
            is GuardVerdict.Blocked -> return Result.failure(verdict.error)
            GuardVerdict.Ready -> Unit
        }
        val request =
            ScanRequest(
                serviceUuid = BleMeshConstants.SERVICE_UUID,
                scanMode = radioProfile.scanMode,
                reportDelayMillis = radioProfile.scanPeriodMs,
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
