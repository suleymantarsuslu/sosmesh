package com.sosmesh.android.meshv2

import com.sosmesh.contracts.meshv2.MeshRelayDecision
import com.sosmesh.contracts.meshv2.MeshRelayDropReason
import com.sosmesh.contracts.meshv2.MeshRelayEngineFactory
import com.sosmesh.contracts.meshv2.MeshRelayEnvelopeV2
import com.sosmesh.contracts.meshv2.relayLogSnapshot
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

enum class MeshV2RelayAction {
    StoredForUplink,
    QueuedForForward,
    Dropped,
    LegacyPassthrough,
}

data class MeshV2RelayResult(
    val action: MeshV2RelayAction,
    val dropReason: MeshRelayDropReason? = null,
    val forwardQueue: MeshForwardQueueSnapshot? = null,
)

/**
 * Multihop relay coordinator: opaque envelope parsing, TTL/dedup/loop, forward queue.
 */
@Singleton
class MeshV2RelayCoordinator
    @Inject
    constructor(
        private val forwardQueue: MeshForwardQueue,
        private val routeSelector: MeshRouteSelector,
    ) {
        private val engine = MeshRelayEngineFactory.createRelayEngine(lruCapacity = 512)

        private val json = Json { ignoreUnknownKeys = true }

        fun onWirePayload(
            payload: ByteArray,
            relayDeviceIdHash: String,
            nowMs: Long,
            batteryQuotaAllowsForward: Boolean,
            uplinkInternetAvailable: Boolean,
        ): MeshV2RelayResult {
            val parsed = parseV2(payload) ?: return MeshV2RelayResult(MeshV2RelayAction.LegacyPassthrough)

            privacyGuard(parsed)

            val outcome = engine.evaluateForward(parsed, relayDeviceIdHash)
            if (outcome.decision == MeshRelayDecision.DROP) {
                return MeshV2RelayResult(
                    action = MeshV2RelayAction.Dropped,
                    dropReason = outcome.dropReason,
                )
            }

            val forward = requireNotNull(outcome.forward)
            val forwardBytes = json.encodeToString(MeshRelayEnvelopeV2.serializer(), forward).toByteArray()

            val queueSnapshot =
                forwardQueue.enqueue(
                    MeshForwardQueueItem(
                        envelope = forward,
                        wireBytes = forwardBytes,
                        enqueuedAtMs = nowMs,
                    ),
                    batteryQuotaAllowsEnqueue = batteryQuotaAllowsForward,
                )

            if (queueSnapshot.lastEviction == MeshForwardEvictionReason.BatteryQuota) {
                return MeshV2RelayResult(
                    action = MeshV2RelayAction.Dropped,
                    forwardQueue = queueSnapshot,
                )
            }

            val action =
                if (uplinkInternetAvailable) {
                    MeshV2RelayAction.StoredForUplink
                } else {
                    MeshV2RelayAction.QueuedForForward
                }

            return MeshV2RelayResult(
                action = action,
                forwardQueue = queueSnapshot,
            )
        }

        fun pollForwardHandoff(): MeshForwardQueueItem? = forwardQueue.pollNext()

        fun peekForwardHandoff(): MeshForwardQueueItem? = forwardQueue.peekNext()

        fun selectHandoffPeer(candidates: List<MeshPeerCandidate>) = routeSelector.selectBestPeer(candidates)

        private fun parseV2(payload: ByteArray): MeshRelayEnvelopeV2? {
            return try {
                val root = json.decodeFromString(MeshRelayEnvelopeV2.serializer(), payload.decodeToString())
                if (root.protocolVersion != 2) {
                    null
                } else {
                    root
                }
            } catch (_: Exception) {
                null
            }
        }

        private fun privacyGuard(envelope: MeshRelayEnvelopeV2) {
            val snapshot = relayLogSnapshot(envelope)
            val forbidden =
                listOf("deprem", "yangın", "yaralanma", "SENTETIK", "İstanbul", "🚨")
            for (marker in forbidden) {
                require(!snapshot.contains(marker)) {
                    "relay log snapshot must remain opaque"
                }
            }
        }
    }
