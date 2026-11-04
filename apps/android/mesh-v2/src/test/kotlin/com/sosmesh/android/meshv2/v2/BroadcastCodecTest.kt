package com.sosmesh.android.meshv2.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BroadcastCodecTest {
    @Test
    fun encodeDecode_broadcastWithoutRegion() {
        val broadcast = ServerBroadcast(
            id = "test-id-123",
            title = "Test Alert",
            body = "This is a test broadcast",
            severity = "info",
            createdAt = "2026-11-04T12:00:00Z",
            expiresAt = "2026-11-05T12:00:00Z",
            regionLat = null,
            regionLng = null,
            regionRadiusKm = null,
            signature = java.util.Base64.getEncoder().encodeToString(ByteArray(64)),
            hopsLeft = 8,
        )

        val encoded = MeshV2FrameCodec.encodeBroadcast(broadcast)
        val decoded = MeshV2FrameCodec.decode(encoded)

        assertNotNull(decoded)
        assertTrue(decoded is MeshV2Frame.Broadcast)
        val decodedBroadcast = (decoded as MeshV2Frame.Broadcast).broadcast
        assertEquals(broadcast.id, decodedBroadcast.id)
        assertEquals(broadcast.title, decodedBroadcast.title)
        assertEquals(broadcast.body, decodedBroadcast.body)
        assertEquals(broadcast.severity, decodedBroadcast.severity)
        assertEquals(broadcast.hopsLeft, decodedBroadcast.hopsLeft)
        assertNull(decodedBroadcast.regionLat)
    }

    @Test
    fun encodeDecode_broadcastWithRegion() {
        val broadcast = ServerBroadcast(
            id = "test-id-456",
            title = "Regional Alert",
            body = "This is a regional test broadcast",
            severity = "warning",
            createdAt = "2026-11-04T12:00:00Z",
            expiresAt = "2026-11-05T12:00:00Z",
            regionLat = 40.7128,
            regionLng = -74.0060,
            regionRadiusKm = 50.0,
            signature = java.util.Base64.getEncoder().encodeToString(ByteArray(64)),
            hopsLeft = 7,
        )

        val encoded = MeshV2FrameCodec.encodeBroadcast(broadcast)
        val decoded = MeshV2FrameCodec.decode(encoded)

        assertNotNull(decoded)
        assertTrue(decoded is MeshV2Frame.Broadcast)
        val decodedBroadcast = (decoded as MeshV2Frame.Broadcast).broadcast
        assertEquals(broadcast.id, decodedBroadcast.id)
        assertEquals(broadcast.regionLat!!, decodedBroadcast.regionLat!!, 0.0001)
        assertEquals(broadcast.regionLng!!, decodedBroadcast.regionLng!!, 0.0001)
        assertEquals(broadcast.regionRadiusKm!!, decodedBroadcast.regionRadiusKm!!, 0.01)
    }

    @Test
    fun decode_invalidPacket() {
        val invalidPacket = byteArrayOf(0x35, 0x00)
        val decoded = MeshV2FrameCodec.decode(invalidPacket)
        assertNull(decoded)
    }

    @Test
    fun hopLimit_enforcedOnDecode() {
        val broadcast = ServerBroadcast(
            id = "test-id",
            title = "Test",
            body = "Test",
            severity = "info",
            createdAt = "2026-11-04T12:00:00Z",
            expiresAt = "2026-11-05T12:00:00Z",
            regionLat = null,
            regionLng = null,
            regionRadiusKm = null,
            signature = java.util.Base64.getEncoder().encodeToString(ByteArray(64)),
            hopsLeft = 15,
        )

        val encoded = MeshV2FrameCodec.encodeBroadcast(broadcast)
        val decoded = MeshV2FrameCodec.decode(encoded) as MeshV2Frame.Broadcast

        assertEquals(MeshV2Wire.MAX_HOPS, decoded.broadcast.hopsLeft)
    }
}
