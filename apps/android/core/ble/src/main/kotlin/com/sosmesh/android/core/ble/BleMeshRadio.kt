package com.sosmesh.android.core.ble

/**
 * Facade for peer discovery lifecycle (ADIM 14).
 */
interface BleMeshRadio {
    fun startPeerDiscovery(foregroundVisible: Boolean = true): Result<Unit>

    fun stopPeerDiscovery()

    fun refreshStatus(): BleRadioStatus

    fun connectFirstDiscoveredPeer(): Result<Unit>

    fun disconnectPeerSession()
}
