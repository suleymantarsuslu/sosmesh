package com.sosmesh.android.core.ble

enum class GattUiConnectionState {
    NONE,
    CONNECTING,
    DISCOVERING,
    READY,
    BACKOFF,
}

data class BleRadioStatus(
    val bluetoothEnabled: Boolean,
    val permissionsGranted: Boolean,
    val locationServicesOk: Boolean,
    val scanning: Boolean,
    val advertising: Boolean,
    val peerCount: Int,
    val gattState: GattUiConnectionState,
    val statusMessage: String,
)
