package com.sosmesh.android.meshv2.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files

class CarryMetaStoreTest {
    @Test
    fun persistsHopsAndSprayPeersAcrossReload() {
        val dir = Files.createTempDirectory("carry").toFile()
        val file = java.io.File(dir, "meta.json")
        val store = CarryMetaStore(file)
        store.put("m1", CarryMetaStore.Meta(receivedHopCount = 2, originCreatedAtMs = 1, receivedAtMs = 1))
        assertEquals(3, store.get("m1")!!.uploadHopCount)
        assertTrue((1..4).all { store.claimPeer("m1", "p$it", peerCloserToGateway = false) })
        assertFalse(store.claimPeer("m1", "p5", peerCloserToGateway = false))
        assertTrue(store.claimPeer("m1", "gw", peerCloserToGateway = true))
        assertFalse(store.claimPeer("m1", "gw", peerCloserToGateway = true))
        val reloaded = CarryMetaStore(file)
        assertEquals(5, reloaded.get("m1")!!.forwardedPeers.size)
        assertFalse(reloaded.canForwardTo("m1", "p9", peerCloserToGateway = false))
        assertTrue(reloaded.canForwardTo("m1", "p9", peerCloserToGateway = true))
        reloaded.prune(CarryMetaStore.RETENTION_MS + 2)
        assertEquals(null, CarryMetaStore(file).get("m1"))
    }

    @Test
    fun bareL2UploadHopIsOne() {
        val store = CarryMetaStore(null)
        store.put("b", CarryMetaStore.Meta(receivedHopCount = 0, originCreatedAtMs = 0, receivedAtMs = 0))
        assertEquals(1, store.get("b")!!.uploadHopCount)
    }
}
