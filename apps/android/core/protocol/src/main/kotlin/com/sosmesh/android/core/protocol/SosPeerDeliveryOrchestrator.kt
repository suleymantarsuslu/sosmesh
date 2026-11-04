package com.sosmesh.android.core.protocol

import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioError
import com.sosmesh.android.core.ble.GattUiConnectionState
import com.sosmesh.android.core.data.di.IoDispatcher
import com.sosmesh.android.core.data.outbox.SosOutboxReader
import com.sosmesh.android.core.permissions.BleMeshReadiness
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.ble.BleProtocol
import com.sosmesh.contracts.transport.OutboxEntryMeta
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

sealed class SosPeerDeliveryCycleResult {
    data object Idle : SosPeerDeliveryCycleResult()

    data object TransferStarted : SosPeerDeliveryCycleResult()

    data object WaitingForGatt : SosPeerDeliveryCycleResult()

    data object SenderBusy : SosPeerDeliveryCycleResult()

    data class PermissionsMissing(
        val missing: List<String>,
    ) : SosPeerDeliveryCycleResult()

    data class Blocked(
        val reason: String,
    ) : SosPeerDeliveryCycleResult()
}

/**
 * Drives outbox (origin android) → BLE discovery → GATT connect → [BleTransferEngine.sendOutbound].
 */
@Singleton
class SosPeerDeliveryOrchestrator
    @Inject
    constructor(
        private val outboxReader: SosOutboxReader,
        private val outbox: OutboxQueueAdapter,
        private val engine: BleTransferEnginePort,
        private val radio: BleMeshRadio,
        private val permissions: PermissionFlowCoordinator,
        private val bleMeshReadiness: BleMeshReadiness,
        private val peerDeliveryTracker: SosPeerDeliveryTracker,
        private val peerRecordStore: PeerDeliveryRecordStore,
        @IoDispatcher private val ioDispatcher: CoroutineDispatcher,
    ) {
        @Volatile
        private var discoveryActive: Boolean = false

        private val cycleMutex = Mutex()
        private val attemptedPeers = mutableMapOf<String, MutableSet<String>>()

        init {
            peerDeliveryTracker.setCompletionCallback { sosId, peerId, success ->
                if (success && peerId != null) {
                    CoroutineScope(ioDispatcher).launch {
                        val allPeers = getAllDiscoveredPeerIds()
                        val delivered = peerRecordStore.getDeliveredPeers(sosId)
                        val remaining = allPeers - delivered
                        if (remaining.isEmpty() && allPeers.isNotEmpty()) {
                            val entry = outbox.getByKey(sosId, peerDeliveryTracker.active?.digest ?: "")
                            if (entry != null) {
                                peerDeliveryTracker.markPeerReceivedIfAllDelivered(
                                    sosId,
                                    entry.digest,
                                    allPeers,
                                    System.currentTimeMillis(),
                                )
                            }
                        } else if (remaining.isNotEmpty()) {
                            val entry = outbox.getByKey(sosId, peerDeliveryTracker.active?.digest ?: "")
                            if (entry != null && entry.state == "LOCAL_SAVED") {
                                outbox.setRetryAt(sosId, entry.digest, System.currentTimeMillis() + 500L, "continue_fanout")
                            }
                        }
                    }
                }
            }
        }

        private fun getAllDiscoveredPeerIds(): Set<String> {
            val peerHops = radio.peerHops()
            return peerHops.keys.toSet()
        }

        suspend fun runCycle(
            nowMs: Long,
            foregroundVisible: Boolean,
        ): SosPeerDeliveryCycleResult =
            withContext(ioDispatcher) {
                cycleMutex.withLock {
                    runCycleOnIo(nowMs, foregroundVisible)
                }
            }

        private suspend fun runCycleOnIo(
            nowMs: Long,
            foregroundVisible: Boolean,
        ): SosPeerDeliveryCycleResult {
            if (!bleMeshReadiness.canRunBleMeshFeatures()) {
                return SosPeerDeliveryCycleResult.PermissionsMissing(permissions.missingPermissions())
            }
            val due =
                outboxReader.listDueAndroidPeerSend(nowMs).firstOrNull()
                    ?: run {
                        attemptedPeers.clear()
                        return SosPeerDeliveryCycleResult.Idle
                    }
            if (engine.senderState() != TransferState.IDLE) {
                return SosPeerDeliveryCycleResult.SenderBusy
            }
            if (!discoveryActive) {
                radio.startPeerDiscovery(foregroundVisible).onFailure { error ->
                    return mapRadioFailure(error, due, nowMs)
                }
                discoveryActive = true
            }
            radio.tickGattReconnect()
            var status = radio.refreshStatus()
            val triedForThisMessage = attemptedPeers.getOrPut(due.sosId) { mutableSetOf() }
            if (status.gattState != GattUiConnectionState.READY) {
                if (status.peerCount == 0 && radio.peerHops().isEmpty()) {
                    scheduleRetry(due, nowMs + 5_000L, "no_peer")
                    return SosPeerDeliveryCycleResult.Blocked("no_peer")
                }
                if (status.gattState == GattUiConnectionState.NONE ||
                    status.gattState == GattUiConnectionState.BACKOFF
                ) {
                    radio.connectBestPeer(triedForThisMessage).onFailure { error ->
                        scheduleRetry(due, nowMs + 5_000L, error.message ?: "connect_failed")
                        return mapRadioFailure(error, due, nowMs)
                    }
                }
                radio.tickGattReconnect()
                status = radio.refreshStatus()
                if (status.gattState != GattUiConnectionState.READY) {
                    return SosPeerDeliveryCycleResult.WaitingForGatt
                }
            }
            val payload =
                decodeWirePayload(due)
                    ?: run {
                        scheduleRetry(due, nowMs + 5_000L, "invalid_wire_blob")
                        return SosPeerDeliveryCycleResult.Blocked("invalid_wire_blob")
                    }
            val digestOk = verifyDigest(due, payload)
            if (!digestOk) {
                scheduleRetry(due, nowMs + 5_000L, "digest_mismatch")
                return SosPeerDeliveryCycleResult.Blocked("digest_mismatch")
            }
            engine.onGattReady()
            val peerId = radio.connectedPeerId()
            when (val pre = MeshV2CentralSession.preflight(engine, peerId, listOf(due.sosId), nowMs)) {
                MeshV2Preflight.V1Peer -> Unit
                MeshV2Preflight.TombstoneBatchSent -> return SosPeerDeliveryCycleResult.TransferStarted
                is MeshV2Preflight.Statuses ->
                    if (!pre.wants(due.sosId)) {
                        if (peerId != null) {
                            triedForThisMessage.add(peerId)
                            peerRecordStore.recordDelivery(due.sosId, peerId)
                        }
                        radio.disconnectPeerSession()
                        val allPeers = getAllDiscoveredPeerIds()
                        peerDeliveryTracker.markPeerReceivedIfAllDelivered(due.sosId, due.digest, allPeers, nowMs)
                        scheduleRetry(due, nowMs + 500L, "peer_has_copy")
                        return SosPeerDeliveryCycleResult.Idle
                    }
            }
            if (peerId != null) triedForThisMessage.add(peerId)
            peerDeliveryTracker.active = SosPeerDeliveryTracker.ActiveTransfer(due.sosId, due.digest, peerId)
            engine.sendOutbound(due.sosId, due.digest, payload)
            return SosPeerDeliveryCycleResult.TransferStarted
        }

        private fun decodeWirePayload(entry: OutboxEntryMeta): ByteArray? =
            try {
                Base64.getDecoder().decode(entry.encryptedBlobBase64)
            } catch (_: IllegalArgumentException) {
                null
            }

        private fun verifyDigest(
            entry: OutboxEntryMeta,
            payload: ByteArray,
        ): Boolean {
            val computed = Base64.getEncoder().encodeToString(BleProtocol.calculateSHA256(payload))
            return computed == entry.digest
        }

        private suspend fun scheduleRetry(
            entry: OutboxEntryMeta,
            retryAtMs: Long,
            reason: String,
        ) {
            outbox.setRetryAt(entry.sosId, entry.digest, retryAtMs, reason)
        }

        private suspend fun mapRadioFailure(
            error: Throwable,
            entry: OutboxEntryMeta,
            nowMs: Long,
        ): SosPeerDeliveryCycleResult =
            when (error) {
                is BleRadioError.PermissionsMissing ->
                    SosPeerDeliveryCycleResult.PermissionsMissing(error.missing)
                is BleRadioError.BluetoothDisabled -> {
                    scheduleRetry(entry, nowMs + 5_000L, "bluetooth_disabled")
                    SosPeerDeliveryCycleResult.Blocked("bluetooth_disabled")
                }
                is BleRadioError.LocationServicesDisabled -> {
                    scheduleRetry(entry, nowMs + 5_000L, "location_services_disabled")
                    SosPeerDeliveryCycleResult.Blocked("location_services_disabled")
                }
                else -> {
                    scheduleRetry(entry, nowMs + 5_000L, error.message ?: "radio_error")
                    SosPeerDeliveryCycleResult.Blocked(error.message ?: "radio_error")
                }
            }
    }

private const val PEER_HAS_RETRY_MS = 60_000L
