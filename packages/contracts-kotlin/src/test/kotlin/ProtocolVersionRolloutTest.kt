package meshv2

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ProtocolVersionRolloutTest {
    private val engine = MeshRelayEngine(lruCapacity = 128)
    private val relayId = "a".repeat(64)

    private fun sampleEnvelope(messageId: String = "rollout-msg"): MeshRelayEnvelopeV2 =
        MeshRelayEnvelopeV2(
            protocolVersion = 2,
            messageId = messageId,
            hopCount = 0,
            maxHops = 4,
            ttlHops = 4,
            copyCount = 1,
            maxCopyCount = 3,
            originCreatedAt = "2026-11-02T00:00:00.000Z",
            opaqueCiphertextBase64 = "c3R1Yg==",
            hopChainReceipt = HopChainReceiptV2(relayDeviceIdHashes = emptyList()),
        )

    @Test
    fun `v2 client forwards while legacy v1 envelope drops in mixed batch`() {
        val modern = sampleEnvelope("modern-client")
        val legacy =
            sampleEnvelope("legacy-client").copy(protocolVersion = 1)

        val outcomes =
            listOf(legacy, modern, legacy).map { envelope ->
                engine.evaluateForward(envelope, relayId).decision
            }

        assertEquals(listOf(MeshRelayDecision.DROP, MeshRelayDecision.FORWARD, MeshRelayDecision.DROP), outcomes)
    }
}
