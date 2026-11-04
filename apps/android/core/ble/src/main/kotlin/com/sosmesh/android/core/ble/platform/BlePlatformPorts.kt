package com.sosmesh.android.core.ble.platform

import com.sosmesh.android.core.ble.BleMeshConstants

interface BluetoothAdapterPort {
    fun isEnabled(): Boolean
}

interface LocationServicesPort {
    fun isEnabledForBleScan(): Boolean
}

data class ScanRequest(
    val serviceUuid: String,
    val scanMode: Int,
    val reportDelayMillis: Long,
)

interface ScanCallbackPort {
    fun onScanResult(
        serviceUuid: String,
        manufacturerPayload: ByteArray?,
    )

    /** Connectable peer with its BLE address and mesh-v2 h (0xFF = offline/unknown). */
    fun onPeerSighting(
        address: String,
        rssi: Int,
        manufacturerPayload: ByteArray?,
        h: Int,
    ) {
        onScanResult(BleMeshConstants.SERVICE_UUID, manufacturerPayload)
    }
}

interface BleScannerPort {
    fun startScan(
        request: ScanRequest,
        callback: ScanCallbackPort,
    ): Result<Unit>

    fun stopScan()
}

data class AdvertiseRequest(
    val serviceUuid: String,
    val manufacturerCompanyId: Int,
    val manufacturerPayload: ByteArray,
    val includeDeviceName: Boolean,
    /** mesh-v2 §4.2: 3-byte service data for 0xFFF0 (empty = none). */
    val serviceData: ByteArray = ByteArray(0),
)

interface BleAdvertiserPort {
    fun startAdvertising(request: AdvertiseRequest): Result<Unit>

    fun stopAdvertising()
}

data class GattCharacteristicSpec(
    val uuid: String,
    val properties: Set<GattProperty>,
)

enum class GattProperty {
    READ,
    WRITE,
    NOTIFY,
}

interface GattServerWriteListener {
    fun onCharacteristicWrite(
        uuid: String,
        value: ByteArray,
        deviceAddress: String,
    )
}

interface GattServerConnectionListener {
    fun onConnectionStateChanged(
        deviceAddress: String,
        connected: Boolean,
    )
}

interface GattServerPort {
    fun start(
        serviceUuid: String,
        characteristics: List<GattCharacteristicSpec>,
    ): Result<Unit>

    fun stop()

    fun setWriteListener(listener: GattServerWriteListener?)

    fun setConnectionListener(listener: GattServerConnectionListener?)

    fun notifyCharacteristic(
        uuid: String,
        value: ByteArray,
        deviceAddress: String?,
    ): Result<Unit>
}

enum class GattConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    DISCOVERING,
    READY,
}

interface GattClientCallbackPort {
    fun onConnectionStateChanged(state: GattConnectionState)

    fun onServicesDiscovered()

    fun onMtuChanged(mtu: Int)

    fun onCharacteristicChanged(
        uuid: String,
        value: ByteArray,
    ) {
        // Optional until ADIM 15 transfer wiring.
    }
}

interface GattClientPort {
    fun connect(
        peerAddress: String,
        serviceUuid: String,
        callback: GattClientCallbackPort,
    ): Result<Unit>

    fun discoverServices(): Result<Unit>

    fun requestMtu(mtu: Int): Result<Unit>

    fun disconnect()

    fun writeCharacteristic(
        uuid: String,
        value: ByteArray,
    ): Result<Unit>

    fun enableAckNotifications(): Result<Unit>

    fun setClientDataListener(listener: GattClientCallbackPort?)

    /** True when the connected peer exposes [uuid] (mesh-v2: FFF4 ⇒ v2 peer). */
    fun hasCharacteristic(uuid: String): Boolean = false
}
