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
        private val attachmentSource: BleAttachmentSource? = null,
    ) {
        @Volatile
        private var discoveryActive: Boolean = false

        private val cycleMutex = Mutex()
        private val attemptedPeers = mutableMapOf<String, MutableSet<String>>()

        /** Peers that only speak ble-v1: they cannot take attachment transfers, so never wait for them. */
        private val v1Peers = mutableSetOf<String>()

        init {
            peerDeliveryTracker.setCompletionCallback { sosId, digest, peerId, success ->
                if (success && peerId != null) {
                    CoroutineScope(ioDispatcher).launch {
                        val delivered = peerRecordStore.getDeliveredPeers(sosId)
                        if (delivered.size == 1) {
                            outbox.updateState(sosId, digest, "PEER_RECEIVED", System.currentTimeMillis(), null)
                        }
                        // The peer holds the SOS now: its attachments follow on the same link before fan-out moves on.
                        if (peerId !in v1Peers && attachmentSource?.hasPending(sosId, peerId) == true) {
                            outbox.setRetryAt(sosId, digest, System.currentTimeMillis() + 300L, "send_attachments")
                        } else {
                            advanceFanout(sosId, digest)
                        }
                    }
                }
            }
            peerDeliveryTracker.setAttachmentCallback { sosId, digest, attachmentId, peerId, success ->
                if (peerId == null) return@setAttachmentCallback
                CoroutineScope(ioDispatcher).launch {
                    val source = attachmentSource ?: return@launch
                    if (success) source.markDelivered(sosId, attachmentId, peerId) else source.markFailed(sosId, attachmentId, peerId)
                    if (success && source.hasPending(sosId, peerId)) {
                        outbox.setRetryAt(sosId, digest, System.currentTimeMillis() + 300L, "send_attachments")
                    } else {
                        advanceFanout(sosId, digest)
                    }
                }
            }
        }

        private suspend fun advanceFanout(
            sosId: String,
            digest: String,
        ) {
            val allPeers = getAllDiscoveredPeerIds()
            val delivered = peerRecordStore.getDeliveredPeers(sosId)
            val remaining = allPeers - delivered
            if (remaining.isEmpty() && allPeers.isNotEmpty()) {
                peerRecordStore.clearMessageRecords(sosId)
                outbox.setRetryAt(sosId, digest, Long.MAX_VALUE, null)
            } else if (remaining.isNotEmpty()) {
                val entry = outbox.getByKey(sosId, digest)
                if (entry != null) {
                    outbox.setRetryAt(sosId, digest, System.currentTimeMillis() + 500L, "continue_fanout")
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
            val deliveredPeers = peerRecordStore.getDeliveredPeers(due.sosId)
            val excludePeers = (triedForThisMessage + deliveredPeers).filterNot { peer ->
                // A peer that has the SOS but still lacks attachments must stay connectable.
                attachmentSource?.hasPending(due.sosId, peer) == true
            }.toSet()
            if (status.gattState != GattUiConnectionState.READY) {
                if (status.peerCount == 0 && radio.peerHops().isEmpty()) {
                    scheduleRetry(due, nowMs + 5_000L, "no_peer")
                    return SosPeerDeliveryCycleResult.Blocked("no_peer")
                }
                if (status.gattState == GattUiConnectionState.NONE ||
                    status.gattState == GattUiConnectionState.BACKOFF
                ) {
                    radio.connectBestPeer(excludePeers).onFailure { error ->
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
                MeshV2Preflight.V1Peer -> { if (peerId != null) v1Peers.add(peerId) }
                MeshV2Preflight.TombstoneBatchSent -> return SosPeerDeliveryCycleResult.TransferStarted
                is MeshV2Preflight.Statuses ->
                    if (!pre.wants(due.sosId)) {
                        if (peerId != null) {
                            val blob = attachmentSource?.nextFor(due.sosId, peerId)
                            if (blob != null) {
                                peerDeliveryTracker.active =
                                    SosPeerDeliveryTracker.ActiveTransfer(due.sosId, due.digest, peerId, blob.attachmentId)
                                engine.sendOutbound(due.sosId, blob.digest, blob.bytes)
                                return SosPeerDeliveryCycleResult.TransferStarted
                            }
                        }
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
