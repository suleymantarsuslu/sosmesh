package com.sosmesh.android.meshv2.v2

import com.sosmesh.contracts.meshv2.HopChainReceiptV2
import com.sosmesh.contracts.meshv2.MeshRelayDropReason
import com.sosmesh.contracts.meshv2.MeshRelayEnvelopeV2
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.Instant
import java.util.Base64

/** §2.4 classification of a reassembled ble-v1 transfer payload. */
sealed class MeshV2Payload {
    data class L1(val envelope: MeshRelayEnvelopeV2, val l2Bytes: ByteArray) : MeshV2Payload()

    data class Tombstones(val batch: TombstoneBatchV2) : MeshV2Payload()

    data class BareL2(val messageId: String, val l2Bytes: ByteArray) : MeshV2Payload()

    data object Discard : MeshV2Payload()
}

sealed class ReceiveOutcome {
    data class Stored(val messageKey: MessageKey) : ReceiveOutcome()

    data class Dropped(val reason: String) : ReceiveOutcome()

    data class TombstonesApplied(val purged: Int, val accepted: Int) : ReceiveOutcome()

    data object Ignored : ReceiveOutcome()
}

sealed class BroadcastReceiveOutcome {
    data object Stored : BroadcastReceiveOutcome()
    data object AlreadySeen : BroadcastReceiveOutcome()
    data object Expired : BroadcastReceiveOutcome()
    data object MaxHops : BroadcastReceiveOutcome()
    data object Full : BroadcastReceiveOutcome()
    data class Invalid(val reason: String) : BroadcastReceiveOutcome()
}

/**
 * Platform-independent mesh v2 node state: seen cache, carry store (incl. own outbox mirror), tombstones and h.
 * Relays never decrypt: only envelope fields of L2 are read and the L2 bytes are kept verbatim.
 */
class MeshV2Node(
    val seen: SeenCache = SeenCache(),
    val tombstones: TombstoneStore = TombstoneStore(),
    val carry: CarryStore = CarryStore(),
    val broadcasts: BroadcastCarryStore = BroadcastCarryStore(),
    val hops: GatewayHopsTracker = GatewayHopsTracker(),
    private val verifier: TombstoneVerifier,
    private val selfDeviceIdHash: String,
    private val relayIdHex: String,
    private val isWatch: Boolean = false,
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val responder = OfferResponder(seen, tombstones)

    @Volatile var relayEnabled: Boolean = true

    fun selfKey(nowMs: Long): Int = MeshInfo.selfKey(relayIdHex, nowMs)

    fun currentH(nowMs: Long): Int = hops.compute(selfKey(nowMs), nowMs).h

    fun flags(nowMs: Long): Int {
        var f = 0
        if (relayEnabled) f = f or MeshV2Wire.FLAG_RELAY_ON
        if (relayEnabled && carry.hasRoom()) f = f or MeshV2Wire.FLAG_ACCEPTS_CARRY
        if (isWatch) f = f or MeshV2Wire.FLAG_WATCH
        if (carry.ordered().any { it.own }) f = f or MeshV2Wire.FLAG_OWN_PENDING
        return f
    }

    fun meshInfo(nowMs: Long): MeshInfo {
        val state = hops.compute(selfKey(nowMs), nowMs)
        return MeshInfo(
            h = state.h,
            flags = flags(nowMs),
            carryFillPercent = carry.fillPercent(),
            secondsSinceConfirmed = if (state.h == MeshV2Wire.H_OFFLINE) 0xFFFF else ((nowMs - state.confirmedAtMs) / 1000).toInt(),
            selfKey = selfKey(nowMs),
            parentKey = if (state.h == 0 || state.h == MeshV2Wire.H_OFFLINE) 0 else state.parentKey,
        )
    }

    fun advertisementServiceData(nowMs: Long): ByteArray = MeshV2Advertisement.androidServiceData(currentH(nowMs), flags(nowMs))

    /** Peripheral: answer a CONTROL write. Returns frames to notify on FFF3 (in order). */
    fun onControlFrame(
        bytes: ByteArray,
        nowMs: Long,
        maxNotifyBytes: Int,
    ): List<ByteArray> =
        when (val frame = MeshV2FrameCodec.decode(bytes)) {
            is MeshV2Frame.Offer -> {
                val statuses = responder.reply(frame.keys, nowMs, relayEnabled, carry.hasRoom())
                listOf(MeshV2FrameCodec.encodeOfferReply(statuses))
            }
            is MeshV2Frame.TombstoneRequest ->
                frame.keys.mapNotNull { tombstones.get(it) }.mapNotNull { t ->
                    val out = MeshV2FrameCodec.encodeTombstone(t.copy(hopsLeft = maxOf(0, t.hopsLeft - 1)))
                    out.takeIf { it.size <= maxNotifyBytes }
                }
            is MeshV2Frame.Broadcast -> {
                onBroadcastFrame(frame.broadcast, nowMs)
                emptyList()
            }
            else -> emptyList()
        }

    fun onBroadcastFrame(broadcast: ServerBroadcast, nowMs: Long): BroadcastReceiveOutcome {
        if (broadcasts.contains(broadcast.id)) {
            return BroadcastReceiveOutcome.AlreadySeen
        }
        val expiresAt = try {
            java.time.Instant.parse(broadcast.expiresAt).toEpochMilli()
        } catch (e: Exception) {
            return BroadcastReceiveOutcome.Invalid("bad expiresAt")
        }
        if (expiresAt <= nowMs) {
            return BroadcastReceiveOutcome.Expired
        }
        if (broadcast.hopsLeft <= 0) {
            return BroadcastReceiveOutcome.MaxHops
        }
        if (!broadcasts.put(broadcast, nowMs)) {
            return BroadcastReceiveOutcome.Full
        }
        return BroadcastReceiveOutcome.Stored
    }

    fun forwardBroadcast(broadcast: ServerBroadcast): ServerBroadcast? {
        if (broadcast.hopsLeft <= 0) return null
        return broadcast.copy(hopsLeft = broadcast.hopsLeft - 1)
    }

    fun classify(payload: ByteArray): MeshV2Payload {
        val root =
            try {
                json.parseToJsonElement(payload.decodeToString()) as? JsonObject
            } catch (_: Exception) {
                null
            } ?: return MeshV2Payload.Discard
        return try {
            when {
                root["protocolVersion"]?.jsonPrimitive?.intOrNull == 2 && root.containsKey("messageId") -> {
                    val env = json.decodeFromJsonElement(MeshRelayEnvelopeV2.serializer(), root)
                    MeshV2Payload.L1(env, Base64.getDecoder().decode(env.opaqueCiphertextBase64))
                }
                root["kind"]?.jsonPrimitive?.contentOrNull == TombstoneBatchV2.KIND ->
                    MeshV2Payload.Tombstones(json.decodeFromJsonElement(TombstoneBatchV2.serializer(), root))
                root["version"]?.jsonPrimitive?.intOrNull == 1 && root["id"]?.jsonPrimitive?.contentOrNull != null ->
                    MeshV2Payload.BareL2(root["id"]!!.jsonPrimitive.content, payload)
                else -> MeshV2Payload.Discard
            }
        } catch (_: Exception) {
            MeshV2Payload.Discard
        }
    }

    /** Receive a reassembled transfer. [packetHashOf] computes §1 packetHash over the carried L2 bytes. */
    fun onTransferPayload(
        payload: ByteArray,
        nowMs: Long,
        packetHashOf: (ByteArray) -> String,
    ): ReceiveOutcome =
        when (val p = classify(payload)) {
            is MeshV2Payload.Tombstones -> applyTombstones(p.batch.items, nowMs)
            is MeshV2Payload.L1 -> acceptCopy(p.envelope, p.l2Bytes, nowMs, packetHashOf)
            is MeshV2Payload.BareL2 -> acceptCopy(wrapBare(p.messageId, p.l2Bytes), p.l2Bytes, nowMs, packetHashOf)
            MeshV2Payload.Discard -> ReceiveOutcome.Ignored
        }

    fun applyTombstones(
        items: List<DeliveryTombstone>,
        nowMs: Long,
    ): ReceiveOutcome.TombstonesApplied {
        var purged = 0
        var accepted = 0
        items.forEach { t ->
            if (!verifier.isValid(t, nowMs)) return@forEach
            when (carry.applyTombstone(t)) {
                PurgeResult.PURGED -> purged++
                PurgeResult.OWN_MARKED_ACCEPTED -> accepted++
                PurgeResult.HASH_MISMATCH -> return@forEach
                PurgeResult.NOT_FOUND -> Unit
            }
            seen.mark(t.messageKey, SeenState.DELIVERED, nowMs)
            tombstones.put(t)
        }
        return ReceiveOutcome.TombstonesApplied(purged, accepted)
    }

    /** Own SOS enters the queue (origin device). Own items are first in [CarryStore.ordered]. */
    fun addOwn(
        messageId: String,
        l2Bytes: ByteArray,
        packetHash: String,
        createdAtMs: Long,
        nowMs: Long,
    ) {
        carry.put(CarryItem(messageId, l2Bytes, packetHash, 1, createdAtMs, 0, own = true))
        seen.mark(MeshV2Wire.messageKey(messageId), SeenState.CARRYING, nowMs)
    }

    /**
     * §4.3: may [peerId] receive this copy? Always toward a lower-h peer; toward an offline/equal peer only while
     * fewer than [SPRAY_PEER_LIMIT] distinct peers got it. Records the peer when allowed.
     */
    fun claimForward(
        item: CarryItem,
        peerId: String,
        peerCloserToGateway: Boolean,
    ): Boolean = item.claimPeer(peerId, if (peerCloserToGateway) Int.MAX_VALUE else SPRAY_PEER_LIMIT)

    /** §2.3 forward rules for the L1 a relay would send next. Null = drop. */
    fun forwardEnvelope(
        item: CarryItem,
        copyCount: Int,
    ): MeshRelayEnvelopeV2? {
        if (item.hopCount >= MeshV2Wire.MAX_HOPS) return null
        return MeshRelayEnvelopeV2(
            protocolVersion = 2,
            messageId = item.messageId,
            hopCount = item.hopCount,
            maxHops = MeshV2Wire.MAX_HOPS,
            ttlHops = MeshV2Wire.MAX_HOPS - item.hopCount,
            copyCount = copyCount,
            maxCopyCount = MAX_COPY_COUNT,
            originCreatedAt = Instant.ofEpochMilli(item.originCreatedAtMs).toString(),
            opaqueCiphertextBase64 = Base64.getEncoder().encodeToString(item.l2Bytes),
            hopChainReceipt = HopChainReceiptV2(item.relayChain),
            peerAckHint = PEER_RECEIVED_ONLY,
        )
    }

    private fun acceptCopy(
        env: MeshRelayEnvelopeV2,
        l2Bytes: ByteArray,
        nowMs: Long,
        packetHashOf: (ByteArray) -> String,
    ): ReceiveOutcome {
        val key = MeshV2Wire.messageKey(env.messageId)
        val drop = dropReason(env, nowMs)
        if (drop != null) {
            seen.mark(key, SeenState.DROPPED, nowMs)
            return ReceiveOutcome.Dropped(drop)
        }
        if (!relayEnabled) return ReceiveOutcome.Dropped("REFUSED")
        if (tombstones.get(key) != null || seen.state(key, nowMs) != null) {
            return ReceiveOutcome.Dropped(MeshRelayDropReason.DUPLICATE.name)
        }
        if (l2Bytes.size > MAX_L2_BYTES) return ReceiveOutcome.Dropped(MeshRelayDropReason.INVALID_ENVELOPE.name)
        val priority = readPriority(l2Bytes)
        val origin = parseInstant(env.originCreatedAt) ?: nowMs
        val stored =
            carry.put(
                CarryItem(
                    messageId = env.messageId,
                    l2Bytes = l2Bytes,
                    packetHash = packetHashOf(l2Bytes),
                    priority = priority,
                    originCreatedAtMs = origin,
                    hopCount = env.hopCount + 1,
                    own = false,
                    relayChain = env.hopChainReceipt.relayDeviceIdHashes + selfDeviceIdHash,
                ),
            )
        seen.mark(key, SeenState.CARRYING, nowMs)
        return if (stored) ReceiveOutcome.Stored(key) else ReceiveOutcome.Dropped("FULL")
    }

    fun dropReason(
        env: MeshRelayEnvelopeV2,
        nowMs: Long,
    ): String? {
        val origin = parseInstant(env.originCreatedAt) ?: return MeshRelayDropReason.INVALID_ENVELOPE.name
        return when {
            nowMs > origin + TIME_TTL_MS -> TIME_EXPIRED
            env.hopCount >= minOf(env.maxHops, MeshV2Wire.MAX_HOPS) -> MeshRelayDropReason.MAX_HOPS.name
            env.ttlHops <= 0 -> MeshRelayDropReason.TTL_EXCEEDED.name
            env.copyCount >= env.maxCopyCount -> MeshRelayDropReason.COPY_CAP.name
            selfDeviceIdHash in env.hopChainReceipt.relayDeviceIdHashes -> MeshRelayDropReason.LOOP_DETECTED.name
            else -> null
        }
    }

    private fun wrapBare(
        messageId: String,
        l2: ByteArray,
    ): MeshRelayEnvelopeV2 {
        val ts =
            try {
                (json.parseToJsonElement(l2.decodeToString()) as JsonObject)["envelope"]
                    ?.let { (it as JsonObject)["timestamp"]?.jsonPrimitive?.content }
            } catch (_: Exception) {
                null
            } ?: Instant.EPOCH.toString()
        return MeshRelayEnvelopeV2(
            protocolVersion = 2,
            messageId = messageId,
            hopCount = 0,
            maxHops = MeshV2Wire.MAX_HOPS,
            ttlHops = MeshV2Wire.MAX_HOPS,
            copyCount = 1,
            maxCopyCount = MAX_COPY_COUNT,
            originCreatedAt = ts,
            opaqueCiphertextBase64 = "",
            hopChainReceipt = HopChainReceiptV2(),
            peerAckHint = PEER_RECEIVED_ONLY,
        )
    }

    private fun readPriority(l2: ByteArray): Int =
        try {
            ((json.parseToJsonElement(l2.decodeToString()) as JsonObject)["envelope"] as JsonObject)["priority"]
                ?.jsonPrimitive?.int ?: DEFAULT_PRIORITY
        } catch (_: Exception) {
            DEFAULT_PRIORITY
        }

    private fun parseInstant(s: String): Long? =
        try {
            Instant.parse(s).toEpochMilli()
        } catch (_: Exception) {
            null
        }

    companion object {
        const val TIME_TTL_MS = 24L * 3_600_000L
        const val TIME_EXPIRED = "TIME_EXPIRED"
        const val MAX_COPY_COUNT = 16

        /** §4.3 spray-and-wait: distinct peers per carried copy (tracked on device). */
        const val SPRAY_PEER_LIMIT = 4
        const val MAX_L2_BYTES = 16_384
        const val DEFAULT_PRIORITY = 3
        const val PEER_RECEIVED_ONLY = "PEER_RECEIVED_ONLY"
    }
}
