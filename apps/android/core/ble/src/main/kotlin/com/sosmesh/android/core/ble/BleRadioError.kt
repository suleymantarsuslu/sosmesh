package com.sosmesh.android.core.ble

sealed class BleRadioError(
    message: String,
) : Exception(message) {
    class BluetoothDisabled :
        BleRadioError("Bluetooth adapter is off; radio cannot start.")

    class PermissionsMissing(
        val missing: List<String>,
    ) : BleRadioError("Bluetooth permissions missing: ${missing.joinToString()}")

    class LocationServicesDisabled :
        BleRadioError("Location services are off; BLE scan cannot start on this Android version.")

    class ScanStartFailed(
        cause: Throwable? = null,
    ) : BleRadioError("BLE scan failed to start: ${cause?.message ?: "unknown"}")
}
