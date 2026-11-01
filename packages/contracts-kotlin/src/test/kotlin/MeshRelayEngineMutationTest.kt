package com.sosmesh.contracts.meshv2

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class MeshRelayEngineMutationTest {
    private val relayHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

    @Test
    fun skip_ttl_decrement_changes_drop_vs_baseline() {
        val envelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "mut-ttl-kotlin",
                hopCount = 0,
                maxHops = 5,
                ttlHops = 0,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "dGVzdA==",
                hopChainReceipt = HopChainReceiptV2(),
            )
        val baseline = MeshRelayEngineFactory.createRelayEngine(lruCapacity = 8).evaluateForward(envelope, relayHash)
        assertEquals(MeshRelayDecision.DROP, baseline.decision)
        assertEquals(MeshRelayDropReason.TTL_EXCEEDED, baseline.dropReason)

        val mutated =
            MeshRelayEngineTesting.create(
                MeshRelayEngineTestingConfig(lruCapacity = 8, skipTtlDecrement = true),
            ).evaluateForward(envelope, relayHash)
        assertEquals(MeshRelayDecision.FORWARD, mutated.decision)
    }

    @Test
    fun skip_dedup_check_changes_duplicate_vs_baseline() {
        val envelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "mut-dedup-kotlin",
                hopCount = 0,
                maxHops = 5,
                ttlHops = 2,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "dGVzdA==",
                hopChainReceipt = HopChainReceiptV2(),
            )
        val key = buildDedupKey(envelope)
        val baselineEngine = MeshRelayEngineFactory.createRelayEngine(lruCapacity = 8)
        baselineEngine.seedDedupKey(key)
        assertEquals(
            MeshRelayDropReason.DUPLICATE,
            baselineEngine.evaluateForward(envelope, relayHash).dropReason,
        )

        val mutatedEngine =
            MeshRelayEngineTesting.create(
                MeshRelayEngineTestingConfig(lruCapacity = 8, skipDedupCheck = true),
            )
        mutatedEngine.seedDedupKey(key)
        assertEquals(MeshRelayDecision.FORWARD, mutatedEngine.evaluateForward(envelope, relayHash).decision)
    }

    @Test
    fun skip_loop_guard_changes_loop_detected_vs_baseline() {
        val envelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "mut-loop-kotlin",
                hopCount = 1,
                maxHops = 5,
                ttlHops = 2,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "dGVzdA==",
                hopChainReceipt = HopChainReceiptV2(relayDeviceIdHashes = listOf(relayHash)),
            )
        val baseline = MeshRelayEngineFactory.createRelayEngine(lruCapacity = 8).evaluateForward(envelope, relayHash)
        assertEquals(MeshRelayDropReason.LOOP_DETECTED, baseline.dropReason)

        val mutated =
            MeshRelayEngineTesting.create(
                MeshRelayEngineTestingConfig(lruCapacity = 8, skipLoopGuard = true),
            ).evaluateForward(envelope, relayHash)
        assertEquals(MeshRelayDecision.FORWARD, mutated.decision)
    }

    @Test
    fun skip_max_hops_check_changes_max_hops_vs_baseline() {
        val envelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "mut-hops-kotlin",
                hopCount = 5,
                maxHops = 5,
                ttlHops = 2,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = "dGVzdA==",
                hopChainReceipt = HopChainReceiptV2(),
            )
        val baseline = MeshRelayEngineFactory.createRelayEngine(lruCapacity = 8).evaluateForward(envelope, relayHash)
        assertEquals(MeshRelayDropReason.MAX_HOPS, baseline.dropReason)

        val mutated =
            MeshRelayEngineTesting.create(
                MeshRelayEngineTestingConfig(lruCapacity = 8, skipMaxHopsCheck = true),
            ).evaluateForward(envelope, relayHash)
        assertEquals(MeshRelayDecision.FORWARD, mutated.decision)
    }

    @Test
    fun relay_log_snapshot_does_not_embed_plaintext_note() {
        val note = "مرحبا İstanbul 🚨 SENTETIK_YARDIM"
        val envelope =
            MeshRelayEnvelopeV2(
                protocolVersion = 2,
                messageId = "snap-kotlin",
                hopCount = 0,
                maxHops = 5,
                ttlHops = 2,
                copyCount = 1,
                maxCopyCount = 3,
                originCreatedAt = "2026-11-01T12:00:00Z",
                opaqueCiphertextBase64 = java.util.Base64.getEncoder().encodeToString(note.toByteArray()),
                hopChainReceipt = HopChainReceiptV2(),
            )
        val snapshot = relayLogSnapshot(envelope)
        assertEquals(false, snapshot.contains(note))
        assertEquals(false, snapshot.contains("İstanbul"))
    }
}
