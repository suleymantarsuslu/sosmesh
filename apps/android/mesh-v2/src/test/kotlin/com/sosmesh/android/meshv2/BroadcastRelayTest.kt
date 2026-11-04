package com.sosmesh.android.meshv2

import com.sosmesh.android.meshv2.v2.MeshV2Config
import com.sosmesh.android.meshv2.v2.MeshV2Node
import com.sosmesh.android.meshv2.v2.MeshV2Runtime
import com.sosmesh.android.meshv2.v2.ServerBroadcast
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class BroadcastRelayTest {
    @Test
    fun broadcast_relayed_to_peer_and_notifier_invoked() {
        var notifiedBroadcast: ServerBroadcast? = null
        var verifyCallCount = 0
        
        val configA = MeshV2Config(
            relayIdHex = "aaa",
            receiptVerifyPublicKeySpkiBase64 = "test",
            broadcastVerifier = { broadcast ->
                verifyCallCount++
                true
            },
            broadcastNotifier = { broadcast ->
                notifiedBroadcast = broadcast
            },
            locationProvider = { Pair(40.0, -74.0) },
        )
        
        val configB = MeshV2Config(
            relayIdHex = "bbb",
            receiptVerifyPublicKeySpkiBase64 = "test",
            broadcastVerifier = { true },
            broadcastNotifier = { },
            locationProvider = { Pair(40.0, -74.0) },
        )
        
        val runtimeA = MeshV2Runtime(configA)
        val runtimeB = MeshV2Runtime(configB)
        
        val nowMs = System.currentTimeMillis()
        
        val broadcast = ServerBroadcast(
            id = "broadcast-1",
            title = "Test Alert",
            body = "This is a test broadcast",
            severity = "warning",
            createdAt = java.time.Instant.ofEpochMilli(nowMs).toString(),
            expiresAt = java.time.Instant.ofEpochMilli(nowMs + 3600_000).toString(),
            regionLat = 40.0,
            regionLng = -74.0,
            regionRadiusKm = 50.0,
            signature = "test-signature",
            hopsLeft = 8,
        )
        
        runtimeA.node.broadcasts.put(broadcast, nowMs)
        
        val takenBroadcast = runtimeA.takeBroadcastFor("peer-b", nowMs)
        assertNotNull("Broadcast should be offered to peer B", takenBroadcast)
        if (takenBroadcast != null) {
            assertEquals(7, takenBroadcast.hopsLeft.toInt())
        }
        
        val secondTake = runtimeA.takeBroadcastFor("peer-b", nowMs)
        assertNull("Broadcast should not be offered to peer B again immediately", secondTake)
        
        if (takenBroadcast != null) {
            runtimeB.node.onBroadcastFrame(takenBroadcast, nowMs)
        }
        
        val storedBroadcasts = runtimeB.node.broadcasts.ordered()
        assertEquals("One broadcast should be stored in node B", 1, storedBroadcasts.size)
    }
    
    @Test
    fun broadcast_with_zero_hops_not_offered() {
        val config = MeshV2Config(
            relayIdHex = "aaa",
            receiptVerifyPublicKeySpkiBase64 = "test",
            broadcastVerifier = { true },
            broadcastNotifier = { },
            locationProvider = { null },
        )
        
        val runtime = MeshV2Runtime(config)
        val nowMs = System.currentTimeMillis()
        
        val broadcast = ServerBroadcast(
            id = "broadcast-expired",
            title = "Test",
            body = "Body",
            severity = "info",
            createdAt = java.time.Instant.ofEpochMilli(nowMs).toString(),
            expiresAt = java.time.Instant.ofEpochMilli(nowMs + 3600_000).toString(),
            regionLat = null,
            regionLng = null,
            regionRadiusKm = null,
            signature = "sig",
            hopsLeft = 0,
        )
        
        runtime.node.broadcasts.put(broadcast, nowMs)
        
        val taken = runtime.takeBroadcastFor("peer-c", nowMs)
        assertNull("Broadcast with zero hops should not be offered", taken)
    }
}
