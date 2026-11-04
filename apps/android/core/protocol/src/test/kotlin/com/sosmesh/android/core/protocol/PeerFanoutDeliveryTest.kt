package com.sosmesh.android.core.protocol

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Tests for peer fan-out delivery: messages must be offered to ALL discovered peers.
 */
class PeerFanoutDeliveryTest {
    @Test
    fun fanout_threePeers_oneFailure_otherTwoReceive() = runTest {
        val store = PeerDeliveryRecordStore()
        val sosId = "sos-1"
        
        val allPeers = setOf("peer-a", "peer-b", "peer-c")
        
        assertFalse(store.hasDeliveredToAll(sosId, allPeers))
        
        store.recordDelivery(sosId, "peer-a")
        assertFalse(store.hasDeliveredToAll(sosId, allPeers))
        assertEquals(setOf("peer-a"), store.getDeliveredPeers(sosId))
        
        store.recordDelivery(sosId, "peer-c")
        assertFalse(store.hasDeliveredToAll(sosId, allPeers))
        assertEquals(setOf("peer-a", "peer-c"), store.getDeliveredPeers(sosId))
        
        store.recordDelivery(sosId, "peer-b")
        assertTrue(store.hasDeliveredToAll(sosId, allPeers))
        assertEquals(setOf("peer-a", "peer-b", "peer-c"), store.getDeliveredPeers(sosId))
    }
    
    @Test
    fun fanout_emptyPeerSet_consideredComplete() = runTest {
        val store = PeerDeliveryRecordStore()
        val sosId = "sos-empty"
        
        assertTrue(store.hasDeliveredToAll(sosId, emptySet()))
    }
    
    @Test
    fun fanout_newPeerDiscovered_fanoutContinues() = runTest {
        val store = PeerDeliveryRecordStore()
        val sosId = "sos-2"
        
        val initialPeers = setOf("peer-a", "peer-b")
        store.recordDelivery(sosId, "peer-a")
        store.recordDelivery(sosId, "peer-b")
        
        assertTrue(store.hasDeliveredToAll(sosId, initialPeers))
        
        val extendedPeers = setOf("peer-a", "peer-b", "peer-c")
        assertFalse(store.hasDeliveredToAll(sosId, extendedPeers))
        
        store.recordDelivery(sosId, "peer-c")
        assertTrue(store.hasDeliveredToAll(sosId, extendedPeers))
    }
    
    @Test
    fun fanout_multipleMessages_trackedIndependently() = runTest {
        val store = PeerDeliveryRecordStore()
        val sos1 = "sos-1"
        val sos2 = "sos-2"
        val allPeers = setOf("peer-a", "peer-b")
        
        store.recordDelivery(sos1, "peer-a")
        store.recordDelivery(sos2, "peer-a")
        store.recordDelivery(sos2, "peer-b")
        
        assertFalse(store.hasDeliveredToAll(sos1, allPeers))
        assertTrue(store.hasDeliveredToAll(sos2, allPeers))
        
        store.recordDelivery(sos1, "peer-b")
        assertTrue(store.hasDeliveredToAll(sos1, allPeers))
    }
    
    @Test
    fun fanout_clearRecords_resetsState() = runTest {
        val store = PeerDeliveryRecordStore()
        val sosId = "sos-clear"
        val allPeers = setOf("peer-a", "peer-b")
        
        store.recordDelivery(sosId, "peer-a")
        store.recordDelivery(sosId, "peer-b")
        assertTrue(store.hasDeliveredToAll(sosId, allPeers))
        
        store.clearMessageRecords(sosId)
        assertEquals(emptySet<String>(), store.getDeliveredPeers(sosId))
        assertFalse(store.hasDeliveredToAll(sosId, allPeers))
    }
    
    @Test
    fun fanout_duplicateDelivery_idempotent() = runTest {
        val store = PeerDeliveryRecordStore()
        val sosId = "sos-dup"
        
        store.recordDelivery(sosId, "peer-a")
        store.recordDelivery(sosId, "peer-a")
        store.recordDelivery(sosId, "peer-a")
        
        assertEquals(setOf("peer-a"), store.getDeliveredPeers(sosId))
    }
    
    @Test
    fun fanout_peerSubset_partialDelivery() = runTest {
        val store = PeerDeliveryRecordStore()
        val sosId = "sos-subset"
        val allPeers = setOf("peer-a", "peer-b", "peer-c", "peer-d")
        
        store.recordDelivery(sosId, "peer-a")
        store.recordDelivery(sosId, "peer-c")
        
        assertFalse(store.hasDeliveredToAll(sosId, allPeers))
        
        val subset = setOf("peer-a", "peer-c")
        assertTrue(store.hasDeliveredToAll(sosId, subset))
    }
}
