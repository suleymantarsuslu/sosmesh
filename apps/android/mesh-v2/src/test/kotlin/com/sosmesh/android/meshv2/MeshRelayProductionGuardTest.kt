package com.sosmesh.android.meshv2

import com.sosmesh.contracts.meshv2.MeshRelayDropReason
import com.sosmesh.contracts.meshv2.MeshRelayEngineFactory
import org.junit.Assert.assertEquals
import org.junit.Test

class MeshRelayProductionGuardTest {
    private val relayHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

    @Test
    fun factory_engine_enforces_ttl_dedup_loop_and_max_hops() {
        val engine = MeshRelayEngineFactory.createRelayEngine(lruCapacity = 16)
        val ttlEnvelope =
            """
            {
              "protocolVersion": 2,
              "messageId": "android-ttl0",
              "hopCount": 0,
              "maxHops": 5,
              "ttlHops": 0,
              "copyCount": 1,
              "maxCopyCount": 3,
              "originCreatedAt": "2026-11-01T12:00:00Z",
              "opaqueCiphertextBase64": "Zm9v",
              "hopChainReceipt": { "relayDeviceIdHashes": [] }
            }
            """.trimIndent()
        val parsed =
            kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
                .decodeFromString(
                    com.sosmesh.contracts.meshv2.MeshRelayEnvelopeV2.serializer(),
                    ttlEnvelope,
                )
        assertEquals(
            MeshRelayDropReason.TTL_EXCEEDED,
            engine.evaluateForward(parsed, relayHash).dropReason,
        )
    }

    @Test
    fun coordinator_drops_ttl_zero_duplicate_loop_and_max_hops() {
        val coordinator =
            MeshV2RelayCoordinator(
                forwardQueue = MeshForwardQueue(maxDepth = 8),
                routeSelector = MeshRouteSelector(),
            )

        val ttlPayload =
            """
            {
              "protocolVersion": 2,
              "messageId": "coord-ttl0",
              "hopCount": 0,
              "maxHops": 5,
              "ttlHops": 0,
              "copyCount": 1,
              "maxCopyCount": 3,
              "originCreatedAt": "2026-11-01T12:00:00Z",
              "opaqueCiphertextBase64": "Zm9v",
              "hopChainReceipt": { "relayDeviceIdHashes": [] }
            }
            """.trimIndent().toByteArray()
        val ttlResult =
            coordinator.onWirePayload(
                payload = ttlPayload,
                relayDeviceIdHash = relayHash,
                nowMs = 1L,
                batteryQuotaAllowsForward = true,
                uplinkInternetAvailable = false,
            )
        assertEquals(MeshV2RelayAction.Dropped, ttlResult.action)
        assertEquals(MeshRelayDropReason.TTL_EXCEEDED, ttlResult.dropReason)

        val maxHopPayload =
            """
            {
              "protocolVersion": 2,
              "messageId": "coord-maxhop",
              "hopCount": 5,
              "maxHops": 5,
              "ttlHops": 2,
              "copyCount": 1,
              "maxCopyCount": 3,
              "originCreatedAt": "2026-11-01T12:00:00Z",
              "opaqueCiphertextBase64": "Zm9v",
              "hopChainReceipt": { "relayDeviceIdHashes": [] }
            }
            """.trimIndent().toByteArray()
        val maxHopResult =
            coordinator.onWirePayload(
                payload = maxHopPayload,
                relayDeviceIdHash = relayHash,
                nowMs = 2L,
                batteryQuotaAllowsForward = true,
                uplinkInternetAvailable = false,
            )
        assertEquals(MeshV2RelayAction.Dropped, maxHopResult.action)
        assertEquals(MeshRelayDropReason.MAX_HOPS, maxHopResult.dropReason)

        val loopPayload =
            """
            {
              "protocolVersion": 2,
              "messageId": "coord-loop",
              "hopCount": 1,
              "maxHops": 5,
              "ttlHops": 2,
              "copyCount": 1,
              "maxCopyCount": 3,
              "originCreatedAt": "2026-11-01T12:00:00Z",
              "opaqueCiphertextBase64": "Zm9v",
              "hopChainReceipt": { "relayDeviceIdHashes": ["$relayHash"] }
            }
            """.trimIndent().toByteArray()
        val loopResult =
            coordinator.onWirePayload(
                payload = loopPayload,
                relayDeviceIdHash = relayHash,
                nowMs = 3L,
                batteryQuotaAllowsForward = true,
                uplinkInternetAvailable = false,
            )
        assertEquals(MeshV2RelayAction.Dropped, loopResult.action)
        assertEquals(MeshRelayDropReason.LOOP_DETECTED, loopResult.dropReason)

        val dupPayload =
            """
            {
              "protocolVersion": 2,
              "messageId": "coord-dup",
              "hopCount": 0,
              "maxHops": 5,
              "ttlHops": 2,
              "copyCount": 1,
              "maxCopyCount": 3,
              "originCreatedAt": "2026-11-01T12:00:00Z",
              "opaqueCiphertextBase64": "AQIDBA==",
              "hopChainReceipt": { "relayDeviceIdHashes": [] }
            }
            """.trimIndent().toByteArray()
        val firstForward =
            coordinator.onWirePayload(
                payload = dupPayload,
                relayDeviceIdHash = relayHash,
                nowMs = 4L,
                batteryQuotaAllowsForward = true,
                uplinkInternetAvailable = false,
            )
        assertEquals(MeshV2RelayAction.QueuedForForward, firstForward.action)
        coordinator.pollForwardHandoff()
        val dupResult =
            coordinator.onWirePayload(
                payload = dupPayload,
                relayDeviceIdHash = relayHash,
                nowMs = 5L,
                batteryQuotaAllowsForward = true,
                uplinkInternetAvailable = false,
            )
        assertEquals(MeshV2RelayAction.Dropped, dupResult.action)
        assertEquals(MeshRelayDropReason.DUPLICATE, dupResult.dropReason)
    }
}
