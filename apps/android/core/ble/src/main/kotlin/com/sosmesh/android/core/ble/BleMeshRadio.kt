package com.sosmesh.android.core.ble

/**
 * BLE scan/advertise port (ADIM 14 will provide real implementation).
 */
interface BleMeshRadio {
    fun startScan(): Result<Unit>

    fun stopScan()
}

class MissingBlePermissionsException :
    IllegalStateException("Bluetooth permissions missing; scan cannot start.")
