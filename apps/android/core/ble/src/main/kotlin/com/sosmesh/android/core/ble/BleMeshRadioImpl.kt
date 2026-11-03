package com.sosmesh.android.core.ble

import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BleMeshRadioImpl
    @Inject
    constructor(
        private val coordinator: BleRadioCoordinator,
    ) : BleMeshRadio {
        override fun startPeerDiscovery(foregroundVisible: Boolean): Result<Unit> {
            coordinator.setForegroundVisible(foregroundVisible)
            return coordinator.startDiscovery()
        }

        override fun stopPeerDiscovery() {
            coordinator.stopDiscovery()
        }

        override fun refreshStatus(): BleRadioStatus = coordinator.refreshStatus()

        override fun connectFirstDiscoveredPeer(): Result<Unit> = coordinator.connectToFirstPeer()

        override fun disconnectPeerSession() {
            coordinator.disconnectGatt()
        }

        override fun tickGattReconnect(): Result<Unit>? = coordinator.tickGattReconnect()
    }
