package com.sosmesh.android.core.ble.android

import com.sosmesh.android.core.ble.platform.GattCharacteristicSpec
import com.sosmesh.android.core.ble.platform.GattClientCallbackPort
import com.sosmesh.android.core.ble.platform.GattClientPort
import com.sosmesh.android.core.ble.platform.GattConnectionState
import com.sosmesh.android.core.ble.platform.GattServerPort
import javax.inject.Inject
import javax.inject.Singleton

/**
 * GATT server/client Android bindings are stubbed until ADIM 15 wires full transfer.
 * Ports exist so JVM tests can fake behavior without this class.
 */
@Singleton
class AndroidGattServerPort
    @Inject
    constructor() : GattServerPort {
        override fun start(
            serviceUuid: String,
            characteristics: List<GattCharacteristicSpec>,
        ): Result<Unit> = Result.success(Unit)

        override fun stop() = Unit
    }

@Singleton
class AndroidGattClientPort
    @Inject
    constructor() : GattClientPort {
        private var callback: GattClientCallbackPort? = null

        override fun connect(
            peerAddress: String,
            serviceUuid: String,
            callback: GattClientCallbackPort,
        ): Result<Unit> {
            this.callback = callback
            callback.onConnectionStateChanged(GattConnectionState.CONNECTING)
            callback.onConnectionStateChanged(GattConnectionState.CONNECTED)
            callback.onServicesDiscovered()
            callback.onMtuChanged(512)
            return Result.success(Unit)
        }

        override fun discoverServices(): Result<Unit> {
            callback?.onServicesDiscovered()
            return Result.success(Unit)
        }

        override fun requestMtu(mtu: Int): Result<Unit> {
            callback?.onMtuChanged(mtu)
            return Result.success(Unit)
        }

        override fun disconnect() {
            callback?.onConnectionStateChanged(GattConnectionState.DISCONNECTED)
            callback = null
        }
    }
