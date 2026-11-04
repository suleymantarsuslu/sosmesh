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
        @IoDispatcher private val ioDispatcher: CoroutineDispatcher,
    ) {
        @Volatile
        private var discoveryActive: Boolean = false

        private val cycleMutex = Mutex()

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
                    ?: return SosPeerDeliveryCycleResult.Idle
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
            if (status.gattState != GattUiConnectionState.READY) {
                if (status.peerCount == 0 && radio.peerHops().isEmpty()) {
                    scheduleRetry(due, nowMs + 5_000L, "no_peer")
                    return SosPeerDeliveryCycleResult.Blocked("no_peer")
                }
                if (status.gattState == GattUiConnectionState.NONE ||
                    status.gattState == GattUiConnectionState.BACKOFF
                ) {
                    radio.connectBestPeer().onFailure { error ->
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
            when (val pre = MeshV2CentralSession.preflight(engine, radio.connectedPeerId(), listOf(due.sosId), nowMs)) {
                MeshV2Preflight.V1Peer -> Unit
                MeshV2Preflight.TombstoneBatchSent -> return SosPeerDeliveryCycleResult.TransferStarted
                is MeshV2Preflight.Statuses ->
                    if (!pre.wants(due.sosId)) {
                        // Peer already has it (HAVE) or it reached the server (DELIVERED): never resend; try another peer later.
                        radio.disconnectPeerSession()
                        scheduleRetry(due, nowMs + PEER_HAS_RETRY_MS, "peer_has_copy")
                        return SosPeerDeliveryCycleResult.Idle
                    }
            }
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
