package com.sosmesh.android.core.ble

/**
 * Facade for peer discovery lifecycle (ADIM 14).
 */
interface BleMeshRadio {
    fun startPeerDiscovery(foregroundVisible: Boolean = true): Result<Unit>

    fun stopPeerDiscovery()

    fun refreshStatus(): BleRadioStatus

    fun connectFirstDiscoveredPeer(): Result<Unit>

    /** mesh-v2 §4.3: connect to the lowest-h peer not in [exclude]; returns the peer id (BLE address). */
    fun connectBestPeer(exclude: Set<String> = emptySet()): Result<String> = connectFirstDiscoveredPeer().map { "" }

    fun connectedPeerId(): String? = null

    /** Known peers with their advertised h (0xFF offline). */
    fun peerHops(): Map<String, Int> = emptyMap()

    fun disconnectPeerSession()

    /** Attempt GATT reconnect when session is in backoff; no-op if not applicable. */
    fun tickGattReconnect(): Result<Unit>?
}
