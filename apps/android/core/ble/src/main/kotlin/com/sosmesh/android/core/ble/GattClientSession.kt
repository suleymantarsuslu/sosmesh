package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.GattClientCallbackPort
import com.sosmesh.android.core.ble.platform.GattClientPort
import com.sosmesh.android.core.ble.platform.GattConnectionState

enum class GattSessionState {
    IDLE,
    CONNECTING,
    DISCOVERING,
    MTU_NEGOTIATING,
    READY,
    DISCONNECTING,
    BACKOFF,
}

class GattClientSession(
    private val clientPort: GattClientPort,
    private val peerRegistry: PeerRegistry,
    private val preferredMtu: Int = 512,
    private val clock: Clock = SystemClock,
) : GattClientCallbackPort {
    private var state: GattSessionState = GattSessionState.IDLE
    private var activePeerId: String? = null
    private var backoffUntilMillis: Long = 0L
    private var pendingReconnectPeerId: String? = null

    fun currentState(): GattSessionState = state

    fun activePeer(): String? = activePeerId

    fun backoffUntil(): Long = backoffUntilMillis

    fun connect(
        peerId: String,
        peerAddress: String,
    ): Result<Unit> {
        if (state != GattSessionState.IDLE && state != GattSessionState.BACKOFF) {
            return Result.failure(IllegalStateException("GATT session busy in state $state"))
        }
        if (clock.currentTimeMillis() < backoffUntilMillis) {
            return Result.failure(IllegalStateException("GATT reconnect backoff active"))
        }
        state = GattSessionState.CONNECTING
        activePeerId = peerId
        return clientPort.connect(peerAddress, BleMeshConstants.SERVICE_UUID, this)
    }

    fun disconnect() {
        state = GattSessionState.DISCONNECTING
        clientPort.disconnect()
    }

    fun tickReconnectIfReady(): Result<Unit>? {
        if (state != GattSessionState.BACKOFF) return null
        val peerId = pendingReconnectPeerId ?: return null
        if (clock.currentTimeMillis() < backoffUntilMillis) return null
        return connect(peerId, peerId)
    }

    override fun onConnectionStateChanged(state: GattConnectionState) {
        when (state) {
            GattConnectionState.CONNECTING -> this.state = GattSessionState.CONNECTING
            GattConnectionState.CONNECTED -> {
                this.state = GattSessionState.DISCOVERING
                clientPort.discoverServices()
            }
            GattConnectionState.DISCOVERING -> this.state = GattSessionState.DISCOVERING
            GattConnectionState.READY -> Unit
            GattConnectionState.DISCONNECTED -> handleDisconnect()
        }
    }

    override fun onServicesDiscovered() {
        if (state == GattSessionState.DISCOVERING) {
            beginMtuNegotiation()
        }
    }

    override fun onMtuChanged(mtu: Int) {
        if (mtu >= 23) {
            state = GattSessionState.READY
            activePeerId?.let { peerRegistry.clearReconnectAttempts(it) }
        }
    }

    private fun handleDisconnect() {
        val peerId = activePeerId
        if (peerId != null && state != GattSessionState.DISCONNECTING) {
            val delay = peerRegistry.registerReconnectAttempt(peerId)
            backoffUntilMillis = clock.currentTimeMillis() + delay
            pendingReconnectPeerId = peerId
            state = GattSessionState.BACKOFF
        } else {
            state = GattSessionState.IDLE
            activePeerId = null
            pendingReconnectPeerId = null
            backoffUntilMillis = 0L
        }
    }

    fun beginMtuNegotiation(): Result<Unit> {
        if (state != GattSessionState.DISCOVERING) {
            return Result.failure(IllegalStateException("MTU negotiation only after service discovery"))
        }
        state = GattSessionState.MTU_NEGOTIATING
        return clientPort.requestMtu(preferredMtu)
    }
}
