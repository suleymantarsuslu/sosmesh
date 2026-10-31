package com.sosmesh.android.ui.radio

import androidx.lifecycle.ViewModel
import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioStatus
import com.sosmesh.android.core.ble.GattUiConnectionState
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class RadioDebugViewModel
    @Inject
    constructor(
        private val bleMeshRadio: BleMeshRadio,
    ) : ViewModel() {
        fun refreshStatus(): BleRadioStatus = bleMeshRadio.refreshStatus()

        fun startDiscovery() = bleMeshRadio.startPeerDiscovery(foregroundVisible = true)

        fun stopDiscovery() = bleMeshRadio.stopPeerDiscovery()

        fun connectFirstPeer() = bleMeshRadio.connectFirstDiscoveredPeer()

        fun disconnectPeer() = bleMeshRadio.disconnectPeerSession()

        fun gattConnectedLabel(status: BleRadioStatus): String =
            if (status.gattState == GattUiConnectionState.READY) {
                "Bağlandı (GATT hazır)"
            } else {
                status.statusMessage
            }
    }
