package com.sosmesh.contracts.meshv2

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class MeshRelayEngineProductionGuardTest {
    private val relayHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

    @Test
    fun factory_created_engine_enforces_all_guards() {
        val engine = MeshRelayEngineFactory.createRelayEngine(lruCapacity = 16)

        val ttlZero =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "ttl0",
                hopCount = 0,
                maxHops = 5,
                ttlHops = 0,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "dGVzdA==",
                hopChainReceipt = HopChainReceiptV2(),
            )
        assertEquals(MeshRelayDropReason.TTL_EXCEEDED, engine.evaluateForward(ttlZero, relayHash).dropReason)

        val dupEnvelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "dup",
                hopCount = 0,
                maxHops = 5,
                ttlHops = 2,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "dGVzdA==",
                hopChainReceipt = HopChainReceiptV2(),
            )
        engine.seedDedupKey(buildDedupKey(dupEnvelope))
        assertEquals(MeshRelayDropReason.DUPLICATE, engine.evaluateForward(dupEnvelope, relayHash).dropReason)

        val loopEnvelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "loop",
                hopCount = 1,
                maxHops = 5,
                ttlHops = 2,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "dGVzdA==",
                hopChainReceipt = HopChainReceiptV2(relayDeviceIdHashes = listOf(relayHash)),
            )
        assertEquals(MeshRelayDropReason.LOOP_DETECTED, engine.evaluateForward(loopEnvelope, relayHash).dropReason)

        val maxHopsEnvelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "maxhop",
                hopCount = 5,
                maxHops = 5,
                ttlHops = 2,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "dGVzdA==",
                hopChainReceipt = HopChainReceiptV2(),
            )
        assertEquals(MeshRelayDropReason.MAX_HOPS, engine.evaluateForward(maxHopsEnvelope, relayHash).dropReason)
    }
}
