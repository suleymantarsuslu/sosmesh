package com.sosmesh.android.feature.status

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StatusHopProgressTest {
    @Test
    fun peerReceived_marksEarlierHopsReached() {
        assertTrue(StatusHopProgress.isHopReached("PEER_RECEIVED", "LOCAL_SAVED"))
        assertTrue(StatusHopProgress.isHopReached("PEER_RECEIVED", "PEER_RECEIVED"))
        assertFalse(StatusHopProgress.isHopReached("PEER_RECEIVED", "SERVER_ACCEPTED"))
    }
}
