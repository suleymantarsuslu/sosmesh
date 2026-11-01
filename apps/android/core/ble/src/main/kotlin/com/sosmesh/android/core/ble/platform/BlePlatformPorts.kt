package com.sosmesh.android.core.ble.platform

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

interface GattServerPort {
    fun start(
        serviceUuid: String,
        characteristics: List<GattCharacteristicSpec>,
    ): Result<Unit>

    fun stop()

    fun setWriteListener(listener: GattServerWriteListener?)

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
}
