package com.sosmesh.android.feature.relay.mesh

import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleRadioError
import com.sosmesh.android.core.ble.GattUiConnectionState
import com.sosmesh.android.core.data.di.IoDispatcher
import com.sosmesh.android.core.permissions.BleMeshReadiness
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.core.protocol.BleTransferEnginePort
import com.sosmesh.android.core.protocol.TransferState
import com.sosmesh.android.core.protocol.MeshV2CentralSession
import com.sosmesh.android.core.protocol.MeshV2Preflight
import com.sosmesh.android.meshv2.v2.CarryMetaStore
import com.sosmesh.android.meshv2.v2.MeshV2Node
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import com.sosmesh.android.meshv2.v2.MeshV2Wire
import com.sosmesh.contracts.meshv2.HopChainReceiptV2
import com.sosmesh.contracts.meshv2.MeshRelayEnvelopeV2
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import kotlinx.serialization.json.Json
import java.time.Instant
import java.util.Base64
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
 * mesh-v2 §4.3 relay forwarding: carried copies (outbox origin "relay") go to the lowest-h peer after an OFFER;
 * toward a peer that is not closer to a gateway only while fewer than 4 distinct peers got the copy. Opaque bytes only.
 */
@Singleton
class MeshRelayForwardOrchestrator
    @Inject
    constructor(
        private val outbox: OutboxQueueAdapter,
        private val meshV2: MeshV2Runtime,
        private val engine: BleTransferEnginePort,
        private val radio: BleMeshRadio,
        private val permissions: PermissionFlowCoordinator,
        private val bleMeshReadiness: BleMeshReadiness,
        @IoDispatcher private val ioDispatcher: CoroutineDispatcher,
    ) {
        @Volatile
        private var discoveryActive: Boolean = false

        private val cycleMutex = Mutex()
        private val json = Json { encodeDefaults = true }

        suspend fun runForwardCycle(foregroundVisible: Boolean): MeshRelayForwardCycleResult =
            withContext(ioDispatcher) {
                cycleMutex.withLock {
                    runForwardCycleOnIo(foregroundVisible, System.currentTimeMillis())
                }
            }

        private suspend fun runForwardCycleOnIo(
            foregroundVisible: Boolean,
            nowMs: Long,
        ): MeshRelayForwardCycleResult {
            if (!bleMeshReadiness.canRunBleMeshFeatures()) {
                return MeshRelayForwardCycleResult.PermissionsMissing(permissions.missingPermissions())
            }
            meshV2.carryMeta.prune(nowMs)
            val selfH = meshV2.node.currentH(nowMs)
            val carried =
                outbox.listAll()
                    .filter { it.origin == "relay" && it.state !in DONE_STATES && nowMs < it.expiresAtMs }
                    .mapNotNull { row -> meshV2.carryMeta.get(row.sosId)?.let { row to it } }
                    .filter { (_, meta) -> meta.receivedHopCount + 1 < MeshV2Wire.MAX_HOPS && nowMs <= meta.originCreatedAtMs + TIME_TTL_MS }
                    .sortedBy { it.second.originCreatedAtMs }
            if (carried.isEmpty()) return MeshRelayForwardCycleResult.Idle
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
                val hops = radio.peerHops()
                if (status.peerCount == 0 && hops.isEmpty()) {
                    return MeshRelayForwardCycleResult.Blocked("no_peer")
                }
                if (status.gattState == GattUiConnectionState.NONE ||
                    status.gattState == GattUiConnectionState.BACKOFF
                ) {
                    // Skip peers that already got (or may not get) every carried copy.
                    val exclude =
                        hops.keys.filter { peer ->
                            val closer = (hops[peer] ?: H_OFFLINE) < selfH
                            carried.none { (row, _) -> meshV2.carryMeta.canForwardTo(row.sosId, peer, closer) }
                        }.toSet()
                    radio.connectBestPeer(exclude).onFailure { error ->
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
            val peerId = radio.connectedPeerId() ?: "unknown"
            val peerCloser = (radio.peerHops()[peerId] ?: H_OFFLINE) < selfH
            val eligible = carried.filter { (row, _) -> meshV2.carryMeta.canForwardTo(row.sosId, peerId, peerCloser) }.take(8)
            if (eligible.isEmpty()) {
                radio.disconnectPeerSession()
                return MeshRelayForwardCycleResult.Blocked("no_eligible_copy")
            }
            val ids = eligible.map { it.first.sosId }
            val pick =
                when (val pre = MeshV2CentralSession.preflight(engine, peerId, ids, nowMs)) {
                    MeshV2Preflight.TombstoneBatchSent -> return MeshRelayForwardCycleResult.ForwardStarted
                    MeshV2Preflight.V1Peer -> eligible.first() to false
                    is MeshV2Preflight.Statuses -> {
                        // Peer HAS / DELIVERED: count it as reached, never resend to it.
                        ids.filter { !pre.wants(it) }.forEach { meshV2.carryMeta.claimPeer(it, peerId, true) }
                        val want = eligible.firstOrNull { pre.wants(it.first.sosId) }
                        if (want == null) {
                            radio.disconnectPeerSession()
                            return MeshRelayForwardCycleResult.Idle
                        }
                        want to true
                    }
                }
            val (entry, v2Peer) = pick
            val (row, meta) = entry
            val l2 =
                try {
                    Base64.getDecoder().decode(row.encryptedBlobBase64)
                } catch (_: IllegalArgumentException) {
                    return MeshRelayForwardCycleResult.Blocked("invalid_wire_blob")
                }
            if (!meshV2.carryMeta.claimPeer(row.sosId, peerId, peerCloser)) {
                return MeshRelayForwardCycleResult.Blocked("spray_limit")
            }
            val bytes = if (v2Peer) l1Bytes(row.sosId, l2, meta) else l2
            engine.sendOpaqueForward(bytes)
            return MeshRelayForwardCycleResult.ForwardStarted
        }

        /** §2.3: hopCount +1, ttlHops −1, copyCount +1 (max 16), chain + own deviceIdHash, origin time unchanged. */
        private fun l1Bytes(
            messageId: String,
            l2: ByteArray,
            meta: CarryMetaStore.Meta,
        ): ByteArray {
            val hop = meta.receivedHopCount + 1
            val env =
                MeshRelayEnvelopeV2(
                    protocolVersion = 2,
                    messageId = messageId,
                    hopCount = hop,
                    maxHops = MeshV2Wire.MAX_HOPS,
                    ttlHops = MeshV2Wire.MAX_HOPS - hop,
                    copyCount = (meta.receivedCopyCount + 1).coerceAtMost(MeshV2Node.MAX_COPY_COUNT),
                    maxCopyCount = MeshV2Node.MAX_COPY_COUNT,
                    originCreatedAt = Instant.ofEpochMilli(meta.originCreatedAtMs).toString(),
                    opaqueCiphertextBase64 = Base64.getEncoder().encodeToString(l2),
                    hopChainReceipt = HopChainReceiptV2(meta.relayChain + meshV2.selfDeviceIdHash),
                    peerAckHint = MeshV2Node.PEER_RECEIVED_ONLY,
                )
            return json.encodeToString(MeshRelayEnvelopeV2.serializer(), env).toByteArray(Charsets.UTF_8)
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

private val DONE_STATES = setOf("SERVER_ACCEPTED", "OPERATOR_SEEN", "CASE_IN_PROGRESS")
private const val H_OFFLINE = 0xFF
private const val TIME_TTL_MS = 24L * 3_600_000L
