package com.sosmesh.android.meshv2

import com.sosmesh.contracts.meshv2.MeshRelayDropReason
import org.junit.Assert.assertEquals
import org.junit.Test

class MeshV2RelayCoordinatorTest {
    private val relayHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

    @Test
    fun v2_forward_envelope_queues_handoff() {
        val coordinator =
            MeshV2RelayCoordinator(
                forwardQueue = MeshForwardQueue(maxDepth = 8),
                routeSelector = MeshRouteSelector(),
            )
        val payload =
            """
            {
              "protocolVersion": 2,
              "messageId": "coord-001",
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
        val result =
            coordinator.onWirePayload(
                payload = payload,
                relayDeviceIdHash = relayHash,
                nowMs = 100L,
                batteryQuotaAllowsForward = true,
                uplinkInternetAvailable = false,
            )
        assertEquals(MeshV2RelayAction.QueuedForForward, result.action)
        val handoff = coordinator.pollForwardHandoff()
        assertEquals(1, handoff?.envelope?.hopCount)
        assertEquals(1, handoff?.envelope?.ttlHops)
    }

    @Test
    fun legacy_payload_passthrough() {
        val coordinator =
            MeshV2RelayCoordinator(
                forwardQueue = MeshForwardQueue(maxDepth = 4),
                routeSelector = MeshRouteSelector(),
            )
        val legacy = """{"id":"legacy-sos","version":1}""".toByteArray()
        val result =
            coordinator.onWirePayload(
                payload = legacy,
                relayDeviceIdHash = relayHash,
                nowMs = 1L,
                batteryQuotaAllowsForward = true,
                uplinkInternetAvailable = false,
            )
        assertEquals(MeshV2RelayAction.LegacyPassthrough, result.action)
    }

    @Test
    fun ttl_zero_drops_without_queue() {
        val coordinator =
            MeshV2RelayCoordinator(
                forwardQueue = MeshForwardQueue(maxDepth = 4),
                routeSelector = MeshRouteSelector(),
            )
        val payload =
            """
            {
              "protocolVersion": 2,
              "messageId": "ttl-zero",
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
        val result =
            coordinator.onWirePayload(
                payload = payload,
                relayDeviceIdHash = relayHash,
                nowMs = 1L,
                batteryQuotaAllowsForward = true,
                uplinkInternetAvailable = false,
            )
        assertEquals(MeshV2RelayAction.Dropped, result.action)
        assertEquals(MeshRelayDropReason.TTL_EXCEEDED, result.dropReason)
    }

    @Test(expected = IllegalArgumentException::class)
    fun privacy_guard_blocks_forbidden_marker_in_relay_log_snapshot() {
        val coordinator =
            MeshV2RelayCoordinator(
                forwardQueue = MeshForwardQueue(maxDepth = 4),
                routeSelector = MeshRouteSelector(),
            )
        val payload =
            """
            {
              "protocolVersion": 2,
              "messageId": "coord-SENTETIK-leak",
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
        coordinator.onWirePayload(
            payload = payload,
            relayDeviceIdHash = relayHash,
            nowMs = 1L,
            batteryQuotaAllowsForward = true,
            uplinkInternetAvailable = false,
        )
    }
}
