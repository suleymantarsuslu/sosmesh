package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.GattClientCallbackPort
import com.sosmesh.android.core.ble.platform.GattClientPort
import com.sosmesh.android.core.ble.platform.GattConnectionState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GattClientSessionTest {
    private class FakeClock(
        private var millis: Long,
    ) : Clock {
        override fun currentTimeMillis(): Long = millis

        fun advance(ms: Long) {
            millis += ms
        }
    }

    private class FakeGattClient : GattClientPort {
        var callback: GattClientCallbackPort? = null
        var connected: Boolean = false

        override fun connect(
            peerAddress: String,
            serviceUuid: String,
            callback: GattClientCallbackPort,
        ): Result<Unit> {
            this.callback = callback
            connected = true
            callback.onConnectionStateChanged(GattConnectionState.CONNECTING)
            callback.onConnectionStateChanged(GattConnectionState.CONNECTED)
            callback.onServicesDiscovered()
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
            connected = false
            callback?.onConnectionStateChanged(GattConnectionState.DISCONNECTED)
        }

        override fun writeCharacteristic(
            uuid: String,
            value: ByteArray,
        ): Result<Unit> = Result.success(Unit)

        override fun enableAckNotifications(): Result<Unit> = Result.success(Unit)

        override fun setClientDataListener(listener: GattClientCallbackPort?) = Unit
    }

    @Test
    fun connect_discover_mtu_reachesReady() {
        val clock = FakeClock(0L)
        val client = FakeGattClient()
        val session = GattClientSession(client, PeerRegistry(), clock = clock)
        val result = session.connect("peer1", "peer1")
        assertTrue(result.isSuccess)
        client.requestMtu(512)
        assertEquals(GattSessionState.READY, session.currentState())
    }

    @Test
    fun disconnect_entersBackoff_thenReconnect() {
        val clock = FakeClock(0L)
        val client = FakeGattClient()
        val registry = PeerRegistry(clock = clock)
        val session = GattClientSession(client, registry, clock = clock)
        session.connect("peer1", "peer1")
        client.requestMtu(512)
        client.disconnect()
        assertEquals(GattSessionState.BACKOFF, session.currentState())
        clock.advance(1_000L)
        val reconnect = session.tickReconnectIfReady()
        assertTrue(reconnect != null && reconnect.isSuccess)
        client.requestMtu(512)
        assertEquals(GattSessionState.READY, session.currentState())
    }
}
