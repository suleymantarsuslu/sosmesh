package com.sosmesh.android.feature.relay.mesh

import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioError
import com.sosmesh.android.core.ble.GattUiConnectionState
import com.sosmesh.android.core.data.di.IoDispatcher
import com.sosmesh.android.core.permissions.BleMeshReadiness
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.protocol.BleTransferEnginePort
import com.sosmesh.android.core.protocol.TransferState
import com.sosmesh.android.meshv2.MeshV2RelayCoordinator
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

sealed class MeshRelayForwardCycleResult {
    data object Idle : MeshRelayForwardCycleResult()

    data object ForwardStarted : MeshRelayForwardCycleResult()

    data object WaitingForGatt : MeshRelayForwardCycleResult()

    data object SenderBusy : MeshRelayForwardCycleResult()

    data class PermissionsMissing(
        val missing: List<String>,
    ) : MeshRelayForwardCycleResult()

    data class Blocked(
        val reason: String,
    ) : MeshRelayForwardCycleResult()
}

/**
 * Drains mesh-v2 forward queue over BLE without decrypting opaque envelopes.
 */
@Singleton
class MeshRelayForwardOrchestrator
    @Inject
    constructor(
        private val meshV2RelayCoordinator: MeshV2RelayCoordinator,
        private val engine: BleTransferEnginePort,
        private val radio: BleMeshRadio,
        private val permissions: PermissionFlowCoordinator,
        private val bleMeshReadiness: BleMeshReadiness,
        @IoDispatcher private val ioDispatcher: CoroutineDispatcher,
    ) {
        @Volatile
        private var discoveryActive: Boolean = false

        private val cycleMutex = Mutex()

        suspend fun runForwardCycle(foregroundVisible: Boolean): MeshRelayForwardCycleResult =
            withContext(ioDispatcher) {
                cycleMutex.withLock {
                    runForwardCycleOnIo(foregroundVisible)
                }
            }

        private fun runForwardCycleOnIo(foregroundVisible: Boolean): MeshRelayForwardCycleResult {
            if (!bleMeshReadiness.canRunBleMeshFeatures()) {
                return MeshRelayForwardCycleResult.PermissionsMissing(permissions.missingPermissions())
            }
            val handoff =
                meshV2RelayCoordinator.peekForwardHandoff()
                    ?: return MeshRelayForwardCycleResult.Idle
            if (engine.senderState() != TransferState.IDLE) {
                return MeshRelayForwardCycleResult.SenderBusy
            }
            if (!discoveryActive) {
                radio.startPeerDiscovery(foregroundVisible).onFailure { error ->
                    return mapRadioFailure(error)
                }
                discoveryActive = true
            }
            radio.tickGattReconnect()
            var status = radio.refreshStatus()
            if (status.gattState != GattUiConnectionState.READY) {
                if (status.peerCount == 0) {
                    return MeshRelayForwardCycleResult.Blocked("no_peer")
                }
                if (status.gattState == GattUiConnectionState.NONE ||
                    status.gattState == GattUiConnectionState.BACKOFF
                ) {
                    radio.connectFirstDiscoveredPeer().onFailure { error ->
                        return mapRadioFailure(error)
                    }
                }
                radio.tickGattReconnect()
                status = radio.refreshStatus()
                if (status.gattState != GattUiConnectionState.READY) {
                    return MeshRelayForwardCycleResult.WaitingForGatt
                }
            }
            engine.onGattReady()
            val committed = meshV2RelayCoordinator.pollForwardHandoff()
            if (committed == null || !committed.wireBytes.contentEquals(handoff.wireBytes)) {
                return MeshRelayForwardCycleResult.Blocked("forward_queue_race")
            }
            engine.sendOpaqueForward(committed.wireBytes)
            return MeshRelayForwardCycleResult.ForwardStarted
        }

        private fun mapRadioFailure(error: Throwable): MeshRelayForwardCycleResult =
            when (error) {
                is BleRadioError.PermissionsMissing ->
                    MeshRelayForwardCycleResult.PermissionsMissing(error.missing)
                is BleRadioError.BluetoothDisabled ->
                    MeshRelayForwardCycleResult.Blocked("bluetooth_disabled")
                is BleRadioError.LocationServicesDisabled ->
                    MeshRelayForwardCycleResult.Blocked("location_services_disabled")
                else -> MeshRelayForwardCycleResult.Blocked(error.message ?: "radio_error")
            }
    }
