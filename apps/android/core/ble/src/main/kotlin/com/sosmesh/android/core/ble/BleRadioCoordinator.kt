package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.BluetoothAdapterPort
import com.sosmesh.android.core.ble.platform.LocationServicesPort
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator

class BleRadioCoordinator(
    private val guard: PermissionAndAdapterGuard,
    private val scanner: BleScanner,
    private val advertiser: BleAdvertiser,
    private val gattServer: GattServer,
    private val gattSession: GattClientSession,
    private val peerRegistry: PeerRegistry,
    private val permissionFlowCoordinator: PermissionFlowCoordinator,
    private val bluetoothAdapter: BluetoothAdapterPort,
    private val locationServices: LocationServicesPort,
    private val localRole: PeerRole = PeerRole.BOTH,
) {
    private var foregroundVisible: Boolean = true
    private var advertisingActive: Boolean = false

    fun setForegroundVisible(visible: Boolean) {
        foregroundVisible = visible
    }

    fun refreshStatus(): BleRadioStatus {
        val gattState =
            when (gattSession.currentState()) {
                GattSessionState.IDLE -> GattUiConnectionState.NONE
                GattSessionState.CONNECTING -> GattUiConnectionState.CONNECTING
                GattSessionState.DISCOVERING,
                GattSessionState.MTU_NEGOTIATING,
                -> GattUiConnectionState.DISCOVERING
                GattSessionState.READY -> GattUiConnectionState.READY
                GattSessionState.BACKOFF -> GattUiConnectionState.BACKOFF
                GattSessionState.DISCONNECTING -> GattUiConnectionState.CONNECTING
            }
        val connectedLabel =
            if (gattState == GattUiConnectionState.READY) {
                "GATT oturumu hazır"
            } else {
                "Bağlı değil (GATT hazır callback bekleniyor)"
            }
        return BleRadioStatus(
            bluetoothEnabled = bluetoothAdapter.isEnabled(),
            permissionsGranted = permissionFlowCoordinator.allGranted(),
            locationServicesOk = locationServices.isEnabledForBleScan(),
            scanning = scanner.isScanning(),
            advertising = advertisingActive,
            peerCount = peerRegistry.activePeerCount(),
            gattState = gattState,
            statusMessage = connectedLabel,
        )
    }

    fun startDiscovery(): Result<Unit> {
        val scanResult = scanner.start(foregroundVisible)
        if (scanResult.isFailure) {
            return scanResult
        }
        val advertiseResult = advertiser.start()
        advertisingActive = advertiseResult.isSuccess
        if (advertiseResult.isFailure) {
            scanner.stop()
            advertisingActive = false
            return advertiseResult
        }
        gattServer.start()
        return Result.success(Unit)
    }

    fun stopDiscovery() {
        scanner.stop()
        advertiser.stop()
        gattServer.stop()
        advertisingActive = false
    }

    /** Connects to the best addressable peer (lowest h). Returns its address. */
    fun connectToBestPeer(exclude: Set<String>): Result<String> {
        val best =
            peerRegistry.bestAddressPeer(exclude)
                ?: return Result.failure(IllegalStateException("no_peer"))
        return gattSession.connect(best.address, best.address).map { best.address }
    }

    fun connectedPeerId(): String? = gattSession.activePeer()

    fun peerHops(): Map<String, Int> = peerRegistry.addressPeers().associate { it.address to it.h }

    fun connectToFirstPeer(): Result<Unit> {
        peerRegistry.bestAddressPeer()?.let { best ->
            return gattSession.connect(best.address, best.address)
        }
        val peer =
            peerRegistry.activePeers().firstOrNull()
                ?: return Result.failure(IllegalStateException("Keşfedilen peer yok"))
        return gattSession.connect(peer.ephemeralIdHex, peer.ephemeralIdHex)
    }

    fun disconnectGatt() {
        gattSession.disconnect()
    }

    fun tickGattReconnect(): Result<Unit>? = gattSession.tickReconnectIfReady()
}
