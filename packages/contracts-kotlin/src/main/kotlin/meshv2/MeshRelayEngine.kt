package com.sosmesh.contracts.meshv2

import kotlinx.serialization.Serializable

@Serializable
data class HopChainReceiptV2(
    val relayDeviceIdHashes: List<String> = emptyList(),
)

@Serializable
data class MeshRelayEnvelopeV2(
    val protocolVersion: Int,
    val messageId: String,
    val hopCount: Int,
    val maxHops: Int,
    val ttlHops: Int,
    val copyCount: Int,
    val maxCopyCount: Int,
    val originCreatedAt: String,
    val opaqueCiphertextBase64: String,
    val hopChainReceipt: HopChainReceiptV2,
    val peerAckHint: String? = null,
)

enum class MeshRelayDropReason {
    TTL_EXCEEDED,
    MAX_HOPS,
    DUPLICATE,
    COPY_CAP,
    LOOP_DETECTED,
    INVALID_ENVELOPE,
}

enum class MeshRelayDecision {
    FORWARD,
    DROP,
}

data class MeshRelayEngineOutcome(
    val decision: MeshRelayDecision,
    val dropReason: MeshRelayDropReason? = null,
    val forward: MeshRelayEnvelopeV2? = null,
    val dedupKey: String? = null,
)

data class MeshRelayEngineConfig(
    val lruCapacity: Int,
    val skipTtlDecrement: Boolean = false,
    val skipDedupCheck: Boolean = false,
    val skipLoopGuard: Boolean = false,
    val skipMaxHopsCheck: Boolean = false,
)

private val DEVICE_HASH = Regex("^[a-f0-9]{64}$")

fun buildDedupKey(envelope: MeshRelayEnvelopeV2): String {
    val prefix = envelope.opaqueCiphertextBase64.take(8)
    return "${envelope.messageId}:${envelope.hopCount}:$prefix"
}

fun relayLogSnapshot(envelope: MeshRelayEnvelopeV2): String {
    return """{"messageId":"${envelope.messageId}","hopCount":${envelope.hopCount},"ttlHops":${envelope.ttlHops},"ciphertextPrefix":"${
        envelope.opaqueCiphertextBase64.take(24)
    }"}"""
}

class MeshRelayDedupStore(
    private val capacity: Int,
) {
    private val order = ArrayDeque<String>()
    private val seen = mutableSetOf<String>()

    fun has(key: String): Boolean = seen.contains(key)

    fun remember(key: String) {
        if (seen.contains(key)) {
            return
        }
        seen.add(key)
        order.addLast(key)
        while (order.size > capacity) {
            val evicted = order.removeFirst()
            seen.remove(evicted)
        }
    }
}

class MeshRelayEngine(
    private val config: MeshRelayEngineConfig,
) {
    private val dedup = MeshRelayDedupStore(config.lruCapacity)

    fun seedDedupKey(key: String) {
        dedup.remember(key)
    }

    fun evaluateForward(
        envelope: MeshRelayEnvelopeV2,
        relayDeviceIdHash: String,
    ): MeshRelayEngineOutcome {
        if (!validateEnvelope(envelope)) {
            return MeshRelayEngineOutcome(MeshRelayDecision.DROP, MeshRelayDropReason.INVALID_ENVELOPE)
        }
        if (!DEVICE_HASH.matches(relayDeviceIdHash)) {
            return MeshRelayEngineOutcome(MeshRelayDecision.DROP, MeshRelayDropReason.INVALID_ENVELOPE)
        }

        val dedupKey = buildDedupKey(envelope)
        if (!config.skipDedupCheck && dedup.has(dedupKey)) {
            return MeshRelayEngineOutcome(
                MeshRelayDecision.DROP,
                MeshRelayDropReason.DUPLICATE,
                dedupKey = dedupKey,
            )
        }

        if (
            !config.skipLoopGuard &&
            envelope.hopChainReceipt.relayDeviceIdHashes.contains(relayDeviceIdHash)
        ) {
            return MeshRelayEngineOutcome(
                MeshRelayDecision.DROP,
                MeshRelayDropReason.LOOP_DETECTED,
                dedupKey = dedupKey,
            )
        }

        if (!config.skipMaxHopsCheck && envelope.hopCount >= envelope.maxHops) {
            return MeshRelayEngineOutcome(
                MeshRelayDecision.DROP,
                MeshRelayDropReason.MAX_HOPS,
                dedupKey = dedupKey,
            )
        }

        if (envelope.copyCount >= envelope.maxCopyCount) {
            return MeshRelayEngineOutcome(
                MeshRelayDecision.DROP,
                MeshRelayDropReason.COPY_CAP,
                dedupKey = dedupKey,
            )
        }

        var nextTtl = envelope.ttlHops - 1
        if (config.skipTtlDecrement) {
            nextTtl = envelope.ttlHops
        }
        if (nextTtl < 0) {
            return MeshRelayEngineOutcome(
                MeshRelayDecision.DROP,
                MeshRelayDropReason.TTL_EXCEEDED,
                dedupKey = dedupKey,
            )
        }

        dedup.remember(dedupKey)

        val forward =
            envelope.copy(
                hopCount = envelope.hopCount + 1,
                ttlHops = nextTtl,
                copyCount = envelope.copyCount + 1,
                hopChainReceipt =
                    HopChainReceiptV2(
                        relayDeviceIdHashes =
                            envelope.hopChainReceipt.relayDeviceIdHashes + relayDeviceIdHash,
                    ),
                peerAckHint = "PEER_RECEIVED_ONLY",
            )

        return MeshRelayEngineOutcome(
            MeshRelayDecision.FORWARD,
            forward = forward,
            dedupKey = dedupKey,
        )
    }

    private fun validateEnvelope(envelope: MeshRelayEnvelopeV2): Boolean {
        if (envelope.protocolVersion != 2) {
            return false
        }
        if (envelope.hopCount < 0 || envelope.hopCount > envelope.maxHops) {
            return false
        }
        if (envelope.ttlHops < 0) {
            return false
        }
        if (envelope.copyCount < 1 || envelope.copyCount > envelope.maxCopyCount) {
            return false
        }
        for (hash in envelope.hopChainReceipt.relayDeviceIdHashes) {
            if (!DEVICE_HASH.matches(hash)) {
                return false
            }
        }
        return envelope.opaqueCiphertextBase64.length >= 4
    }
}
