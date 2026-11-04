package com.sosmesh.android.feature.relay

import com.sosmesh.android.core.data.di.OutboxIoScope
import com.sosmesh.android.core.protocol.BleTransferReceiver
import com.sosmesh.android.core.protocol.ErrorCode
import com.sosmesh.android.meshv2.v2.CarryMetaStore
import com.sosmesh.android.meshv2.v2.MeshV2Payload
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import com.sosmesh.android.meshv2.v2.MeshV2Wire
import com.sosmesh.android.meshv2.v2.SeenState
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Peripheral receive path (mesh-v2 §2.4): tombstone batches, L1 envelopes and bare L2. Relays never decrypt; the L2
 * bytes are stored verbatim in the outbox (origin "relay") and the L1 fields in [CarryMetaStore].
 */
@Singleton
class RelayTransferHandler
    @Inject
    constructor(
        private val registrar: RelayEnvelopeRegistrar,
        private val meshV2: MeshV2Runtime,
        private val outboxIoScope: OutboxIoScope,
    ) : BleTransferReceiver.Listener {
        override fun onCompleted(payload: ByteArray) {
            outboxIoScope.launchOutboxWork {
                val nowMs = System.currentTimeMillis()
                if (meshV2.onTransferPayloadTombstones(payload, nowMs)) return@launchOutboxWork
                
                val broadcastFrame = MeshV2Wire.decode(payload) as? MeshV2Wire.MeshV2Frame.Broadcast
                if (broadcastFrame != null) {
                    meshV2.node.onBroadcastFrame(broadcastFrame.broadcast, nowMs)
                    return@launchOutboxWork
                }
                
                val node = meshV2.node
                when (val parsed = node.classify(payload)) {
                    is MeshV2Payload.L1 -> {
                        val env = parsed.envelope
                        if (node.dropReason(env, nowMs) != null) return@launchOutboxWork
                        storeCopy(
                            env.messageId,
                            parsed.l2Bytes,
                            CarryMetaStore.Meta(
                                receivedHopCount = env.hopCount,
                                receivedCopyCount = env.copyCount,
                                relayChain = env.hopChainReceipt.relayDeviceIdHashes,
                                originCreatedAtMs = parseMs(env.originCreatedAt) ?: nowMs,
                                receivedAtMs = nowMs,
                            ),
                            nowMs,
                        )
                    }
                    is MeshV2Payload.BareL2 -> {
                        val created = envelopeTimestampMs(parsed.l2Bytes) ?: nowMs
                        if (nowMs > created + MESH_TIME_TTL_MS) return@launchOutboxWork
                        storeCopy(
                            parsed.messageId,
                            parsed.l2Bytes,
                            CarryMetaStore.Meta(receivedHopCount = 0, originCreatedAtMs = created, receivedAtMs = nowMs),
                            nowMs,
                        )
                    }
                    else -> Unit
                }
            }
        }

        private suspend fun storeCopy(
            messageId: String,
            l2Bytes: ByteArray,
            meta: CarryMetaStore.Meta,
            nowMs: Long,
        ) {
            val key = MeshV2Wire.messageKey(messageId)
            if (meshV2.node.tombstones.get(key) != null) return
            if (!meshV2.node.relayEnabled) return
            if (registrar.registerL2(messageId, l2Bytes, nowMs).isSuccess) {
                if (meshV2.carryMeta.get(messageId) == null) meshV2.carryMeta.put(messageId, meta)
                meshV2.node.seen.mark(key, SeenState.CARRYING, nowMs)
            }
        }

        private fun envelopeTimestampMs(l2: ByteArray): Long? =
            try {
                Json.parseToJsonElement(l2.decodeToString()).jsonObject["envelope"]?.jsonObject
                    ?.get("timestamp")?.jsonPrimitive?.content?.let { Instant.parse(it).toEpochMilli() }
            } catch (_: Exception) {
                null
            }

        private fun parseMs(iso: String): Long? =
            try {
                Instant.parse(iso).toEpochMilli()
            } catch (_: Exception) {
                null
            }

        override fun onFailed(
            code: ErrorCode,
            message: String,
        ) {
            // Transfer failures are retried by the sender; nothing stored.
        }

        private companion object {
            const val MESH_TIME_TTL_MS = 24L * 3_600_000L
        }
    }
