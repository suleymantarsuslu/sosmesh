package com.sosmesh.android.core.ble.android

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Build
import androidx.annotation.RequiresPermission
import androidx.core.content.PermissionChecker
import com.sosmesh.android.core.ble.BleMeshConstants
import com.sosmesh.android.core.ble.MeshV2Hooks
import com.sosmesh.android.core.ble.platform.GattCharacteristicSpec
import com.sosmesh.android.core.ble.platform.GattClientCallbackPort
import com.sosmesh.android.core.ble.platform.GattClientPort
import com.sosmesh.android.core.ble.platform.GattConnectionState
import com.sosmesh.android.core.ble.platform.GattProperty
import com.sosmesh.android.core.ble.platform.GattServerPort
import com.sosmesh.android.core.ble.platform.GattServerWriteListener
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AndroidGattServerPort
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : GattServerPort {
        private var gattServer: BluetoothGattServer? = null
        private var writeListener: GattServerWriteListener? = null
        private val characteristics = mutableMapOf<String, BluetoothGattCharacteristic>()
        private var connectedAddress: String? = null

        override fun start(
            serviceUuid: String,
            specs: List<GattCharacteristicSpec>,
        ): Result<Unit> {
            if (!hasConnectPermission()) {
                return Result.failure(SecurityException("BLUETOOTH_CONNECT not granted"))
            }
            val manager =
                context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
                    ?: return Result.failure(IllegalStateException("No BT adapter"))
            return try {
                closeServerInternal()
                gattServer =
                    openGattServerInternal(
                        manager,
                        object : BluetoothGattServerCallback() {
                            override fun onConnectionStateChange(
                                device: BluetoothDevice?,
                                status: Int,
                                newState: Int,
                            ) {
                                connectedAddress =
                                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                                        device?.address
                                    } else {
                                        null
                                    }
                            }

                            override fun onCharacteristicReadRequest(
                                device: BluetoothDevice?,
                                requestId: Int,
                                offset: Int,
                                characteristic: BluetoothGattCharacteristic?,
                            ) {
                                val target = device ?: return
                                val uuid = characteristic?.uuid?.toString()?.uppercase() ?: return
                                val value =
                                    if (uuid == MeshV2Hooks.MESH_INFO_CHAR_UUID.uppercase()) {
                                        MeshV2Hooks.hooks?.meshInfo(System.currentTimeMillis()) ?: ByteArray(0)
                                    } else {
                                        characteristic.value ?: ByteArray(0)
                                    }
                                val slice = if (offset in 0..value.size) value.copyOfRange(offset, value.size) else ByteArray(0)
                                try {
                                    sendResponseInternal(target, requestId, offset, slice)
                                } catch (_: SecurityException) {
                                    // Permission revoked mid-session.
                                }
                            }

                            override fun onCharacteristicWriteRequest(
                                device: BluetoothDevice?,
                                requestId: Int,
                                characteristic: BluetoothGattCharacteristic?,
                                preparedWrite: Boolean,
                                responseNeeded: Boolean,
                                offset: Int,
                                value: ByteArray?,
                            ) {
                                val address = device?.address ?: return
                                val uuid = characteristic?.uuid?.toString()?.uppercase() ?: return
                                val bytes = value ?: return
                                if (responseNeeded && device != null) {
                                    try {
                                        sendResponseInternal(device, requestId, offset, bytes)
                                    } catch (_: SecurityException) {
                                        // Permission revoked mid-session; ignore stray writes.
                                    }
                                }
                                writeListener?.onCharacteristicWrite(uuid, bytes, address)
                            }

                            override fun onDescriptorReadRequest(
                                device: BluetoothDevice?,
                                requestId: Int,
                                offset: Int,
                                descriptor: BluetoothGattDescriptor?,
                            ) {
                                val target = device ?: return
                                val value = descriptor?.value ?: ByteArray(2)
                                val slice = if (offset in 0..value.size) value.copyOfRange(offset, value.size) else ByteArray(0)
                                try {
                                    sendResponseInternal(target, requestId, offset, slice)
                                } catch (_: SecurityException) {
                                    // Permission revoked mid-session.
                                }
                            }

                            override fun onDescriptorWriteRequest(
                                device: BluetoothDevice?,
                                requestId: Int,
                                descriptor: BluetoothGattDescriptor?,
                                preparedWrite: Boolean,
                                responseNeeded: Boolean,
                                offset: Int,
                                value: ByteArray?,
                            ) {
                                val target = device ?: return
                                val bytes = value ?: return
                                descriptor?.value = bytes
                                if (responseNeeded) {
                                    try {
                                        sendResponseInternal(target, requestId, offset, bytes)
                                    } catch (_: SecurityException) {
                                        // Permission revoked mid-session.
                                    }
                                }
                            }
                        },
                    )
                val service = BluetoothGattService(UUID.fromString(serviceUuid), BluetoothGattService.SERVICE_TYPE_PRIMARY)
                characteristics.clear()
                specs.forEach { spec ->
                    var props = 0
                    if (GattProperty.READ in spec.properties) props = props or BluetoothGattCharacteristic.PROPERTY_READ
                    if (GattProperty.WRITE in spec.properties) {
                        props = props or BluetoothGattCharacteristic.PROPERTY_WRITE
                    }
                    if (GattProperty.NOTIFY in spec.properties) {
                        props = props or BluetoothGattCharacteristic.PROPERTY_NOTIFY
                    }
                    val characteristic =
                        BluetoothGattCharacteristic(
                            UUID.fromString(spec.uuid),
                            props,
                            BluetoothGattCharacteristic.PERMISSION_READ or BluetoothGattCharacteristic.PERMISSION_WRITE,
                        )
                    if (GattProperty.NOTIFY in spec.properties) {
                        val cccd =
                            BluetoothGattDescriptor(
                                UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"),
                                BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE,
                            )
                        characteristic.addDescriptor(cccd)
                    }
                    service.addCharacteristic(characteristic)
                    characteristics[spec.uuid.uppercase()] = characteristic
                }
                val added = gattServer?.addService(service) ?: false
                if (added) Result.success(Unit) else Result.failure(IllegalStateException("GATT service add failed"))
            } catch (securityException: SecurityException) {
                Result.failure(securityException)
            }
        }

        override fun stop() {
            if (hasConnectPermission()) {
                try {
                    closeServerInternal()
                } catch (_: SecurityException) {
                    // ignore
                }
            }
            gattServer = null
            characteristics.clear()
            connectedAddress = null
        }

        override fun setWriteListener(listener: GattServerWriteListener?) {
            writeListener = listener
        }

        override fun notifyCharacteristic(
            uuid: String,
            value: ByteArray,
            deviceAddress: String?,
        ): Result<Unit> {
            if (!hasConnectPermission()) {
                return Result.failure(SecurityException("BLUETOOTH_CONNECT not granted"))
            }
            val characteristic = characteristics[uuid.uppercase()] ?: return Result.failure(IllegalStateException("Unknown char"))
            characteristic.value = value
            val target =
                deviceAddress?.let { addr ->
                    gattServer?.connectedDevices?.firstOrNull { it.address == addr }
                } ?: gattServer?.connectedDevices?.firstOrNull()
            val device = target ?: return Result.failure(IllegalStateException("No connected device"))
            return try {
                val ok = notifyInternal(device, characteristic) ?: false
                if (ok) Result.success(Unit) else Result.failure(IllegalStateException("notify failed"))
            } catch (securityException: SecurityException) {
                Result.failure(securityException)
            }
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun closeServerInternal() {
            gattServer?.close()
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun sendResponseInternal(
            device: BluetoothDevice,
            requestId: Int,
            offset: Int,
            bytes: ByteArray,
        ) {
            gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, bytes)
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun notifyInternal(
            device: BluetoothDevice,
            characteristic: BluetoothGattCharacteristic,
        ): Boolean? = gattServer?.notifyCharacteristicChanged(device, characteristic, false)

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun openGattServerInternal(
            manager: BluetoothManager,
            callback: BluetoothGattServerCallback,
        ): BluetoothGattServer? = manager.openGattServer(context, callback)

        private fun hasConnectPermission(): Boolean = AndroidBlePermissionCheck.canConnect(context)
    }

@Singleton
class AndroidGattClientPort
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : GattClientPort {
        private var gatt: BluetoothGatt? = null
        private var sessionCallback: GattClientCallbackPort? = null
        private var dataListener: GattClientCallbackPort? = null
        private val charMap = mutableMapOf<String, BluetoothGattCharacteristic>()

        override fun connect(
            peerAddress: String,
            serviceUuid: String,
            callback: GattClientCallbackPort,
        ): Result<Unit> {
            if (!hasConnectPermission()) {
                return Result.failure(SecurityException("BLUETOOTH_CONNECT not granted"))
            }
            sessionCallback = callback
            val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = manager?.adapter ?: return Result.failure(IllegalStateException("No BT adapter"))
            return try {
                connectGattWithPermission(adapter, peerAddress, callback)
            } catch (securityException: SecurityException) {
                Result.failure(securityException)
            } catch (_: IllegalArgumentException) {
                Result.failure(IllegalArgumentException("Invalid peer address"))
            }
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun connectGattWithPermission(
            adapter: android.bluetooth.BluetoothAdapter,
            peerAddress: String,
            callback: GattClientCallbackPort,
        ): Result<Unit> {
            val device = adapter.getRemoteDevice(peerAddress)
            callback.onConnectionStateChanged(GattConnectionState.CONNECTING)
            closeGattInternal()
            gatt =
                connectGattInternal(
                    device,
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        BluetoothDevice.TRANSPORT_LE
                    } else {
                        0
                    },
                )
            return Result.success(Unit)
        }

        override fun discoverServices(): Result<Unit> {
            if (!hasConnectPermission()) {
                return Result.failure(SecurityException("BLUETOOTH_CONNECT not granted"))
            }
            return try {
                if (discoverServicesInternal()) Result.success(Unit) else Result.failure(IllegalStateException("discoverServices failed"))
            } catch (securityException: SecurityException) {
                Result.failure(securityException)
            }
        }

        override fun requestMtu(mtu: Int): Result<Unit> {
            if (!hasConnectPermission()) {
                return Result.failure(SecurityException("BLUETOOTH_CONNECT not granted"))
            }
            return try {
                if (requestMtuInternal(mtu)) Result.success(Unit) else Result.failure(IllegalStateException("requestMtu failed"))
            } catch (securityException: SecurityException) {
                Result.failure(securityException)
            }
        }

        override fun disconnect() {
            if (hasConnectPermission()) {
                try {
                    disconnectInternal()
                    closeGattInternal()
                } catch (_: SecurityException) {
                    // ignore
                }
            }
            gatt = null
            charMap.clear()
            sessionCallback?.onConnectionStateChanged(GattConnectionState.DISCONNECTED)
            sessionCallback = null
        }

        override fun writeCharacteristic(
            uuid: String,
            value: ByteArray,
        ): Result<Unit> {
            if (!hasConnectPermission()) {
                return Result.failure(SecurityException("BLUETOOTH_CONNECT not granted"))
            }
            val characteristic = charMap[uuid.uppercase()] ?: return Result.failure(IllegalStateException("Characteristic not ready"))
            return try {
                if (writeCharacteristicInternal(characteristic, value)) {
                    Result.success(Unit)
                } else {
                    Result.failure(IllegalStateException("write failed"))
                }
            } catch (securityException: SecurityException) {
                Result.failure(securityException)
            }
        }

        override fun enableAckNotifications(): Result<Unit> {
            if (!hasConnectPermission()) {
                return Result.failure(SecurityException("BLUETOOTH_CONNECT not granted"))
            }
            val characteristic =
                charMap[BleMeshConstants.ACK_CHAR_UUID.uppercase()]
                    ?: return Result.failure(IllegalStateException("ACK char missing"))
            return try {
                enableAckNotificationsInternal(characteristic)
                Result.success(Unit)
            } catch (securityException: SecurityException) {
                Result.failure(securityException)
            }
        }

        override fun hasCharacteristic(uuid: String): Boolean = charMap.containsKey(uuid.uppercase())

        override fun setClientDataListener(listener: GattClientCallbackPort?) {
            dataListener = listener
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun discoverServicesInternal(): Boolean = gatt?.discoverServices() ?: false

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun requestMtuInternal(mtu: Int): Boolean = gatt?.requestMtu(mtu) ?: false

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun disconnectInternal() {
            gatt?.disconnect()
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun writeCharacteristicInternal(
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
        ): Boolean {
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            characteristic.value = value
            return gatt?.writeCharacteristic(characteristic) ?: false
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun enableAckNotificationsInternal(characteristic: BluetoothGattCharacteristic) {
            val ok = gatt?.setCharacteristicNotification(characteristic, true) ?: false
            if (!ok) throw IllegalStateException("setCharacteristicNotification failed")
            val descriptor = characteristic.getDescriptor(UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"))
            descriptor?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            gatt?.writeDescriptor(descriptor)
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun closeGattInternal() {
            gatt?.close()
        }

        @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
        private fun connectGattInternal(
            device: BluetoothDevice,
            transport: Int,
        ): BluetoothGatt? =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                device.connectGatt(context, false, gattCallback, transport)
            } else {
                device.connectGatt(context, false, gattCallback)
            }

        private fun hasConnectPermission(): Boolean = AndroidBlePermissionCheck.canConnect(context)

        private val gattCallback =
            object : BluetoothGattCallback() {
                override fun onConnectionStateChange(
                    gatt: BluetoothGatt?,
                    status: Int,
                    newState: Int,
                ) {
                    when (newState) {
                        BluetoothProfile.STATE_CONNECTED -> {
                            sessionCallback?.onConnectionStateChanged(GattConnectionState.CONNECTED)
                        }
                        BluetoothProfile.STATE_DISCONNECTED -> {
                            sessionCallback?.onConnectionStateChanged(GattConnectionState.DISCONNECTED)
                        }
                    }
                }

                override fun onServicesDiscovered(
                    gatt: BluetoothGatt?,
                    status: Int,
                ) {
                    if (status != BluetoothGatt.GATT_SUCCESS) return
                    charMap.clear()
                    val service = gatt?.getService(UUID.fromString(BleMeshConstants.SERVICE_UUID)) ?: return
                    listOf(
                        BleMeshConstants.CONTROL_CHAR_UUID,
                        BleMeshConstants.DATA_CHAR_UUID,
                        BleMeshConstants.ACK_CHAR_UUID,
                        MeshV2Hooks.MESH_INFO_CHAR_UUID,
                    ).forEach { id ->
                        service.getCharacteristic(UUID.fromString(id))?.let { charMap[id.uppercase()] = it }
                    }
                    sessionCallback?.onServicesDiscovered()
                }

                override fun onMtuChanged(
                    gatt: BluetoothGatt?,
                    mtu: Int,
                    status: Int,
                ) {
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        sessionCallback?.onMtuChanged(mtu)
                    }
                }

                override fun onCharacteristicChanged(
                    gatt: BluetoothGatt?,
                    characteristic: BluetoothGattCharacteristic?,
                ) {
                    val uuid = characteristic?.uuid?.toString()?.uppercase() ?: return
                    val value = characteristic.value ?: return
                    dataListener?.onCharacteristicChanged(uuid, value)
                    sessionCallback?.onCharacteristicChanged(uuid, value)
                }
            }
    }
