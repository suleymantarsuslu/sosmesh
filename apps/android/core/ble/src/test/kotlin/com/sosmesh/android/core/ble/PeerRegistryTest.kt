package com.sosmesh.android.core.ble

import com.sosmesh.ble.BleProtocol
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PeerRegistryTest {
    private class FakeClock(
        private var millis: Long,
    ) : Clock {
        override fun currentTimeMillis(): Long = millis

        fun advance(ms: Long) {
            millis += ms
        }
    }

    private fun samplePayload(): ByteArray =
        byteArrayOf(
            BleProtocol.PROTOCOL_VERSION,
            0x01,
            0x02,
            0x03,
            0x04,
        )

    @Test
    fun duplicateDiscovery_collapsesToSingleEntry() {
        val clock = FakeClock(1_000L)
        val registry = PeerRegistry(ttlMillis = 60_000L, clock = clock)
        val payload = samplePayload()
        repeat(10) {
            registry.recordDiscovery(payload, PeerRole.SENDER)
        }
        assertEquals(1, registry.activePeerCount())
        val peer = registry.activePeers().single()
        assertEquals(10, peer.discoveryCount)
    }

    @Test
    fun ttlExpiry_removesPeer() {
        val clock = FakeClock(0L)
        val registry = PeerRegistry(ttlMillis = 5_000L, clock = clock)
        registry.recordDiscovery(samplePayload(), PeerRole.RELAY)
        assertEquals(1, registry.activePeerCount())
        clock.advance(6_000L)
        registry.pruneExpired()
        assertTrue(registry.activePeerCount() == 0)
    }
}
