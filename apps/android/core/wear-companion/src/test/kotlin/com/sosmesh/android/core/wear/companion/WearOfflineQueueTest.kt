package com.sosmesh.android.core.wear.companion.queue

import com.sosmesh.android.core.wear.companion.protocol.WearOutboundWireStatus
import com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckStatus
import com.sosmesh.android.core.wear.companion.protocol.WearSosCreateWire
import com.sosmesh.android.core.wear.companion.sync.WearUserFacingPhase
import com.sosmesh.android.core.wear.companion.sync.WearStateSyncEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Test

class WearOfflineQueueTest {
    private val store = InMemoryWearOfflineQueueStore()
    private val queue = WearOfflineQueue(store)

    @Test
    fun enqueue_isIdempotentByMessageId() {
        val wire =
            WearSosCreateWire(
                messageId = "msg-1",
                nonce = "nonce-1",
                sosType = "diğer",
                createdAtMs = 1000L,
            )
        val first = queue.enqueueOrGetExisting(wire, nowMs = 1000L, phoneReachable = false)
        val second = queue.enqueueOrGetExisting(wire, nowMs = 2000L, phoneReachable = true)
        assertSame(first.messageId, second.messageId)
        assertEquals(WearOutboundWireStatus.PHONE_UNREACHABLE, second.status)
    }

    @Test
    fun phoneUnreachable_doesNotMarkQueuedUntilAck() {
        val wire =
            WearSosCreateWire(
                messageId = "msg-2",
                nonce = "nonce-2",
                sosType = "diğer",
                createdAtMs = 1L,
            )
        queue.enqueueOrGetExisting(wire, nowMs = 1L, phoneReachable = false)
        val display =
            WearStateSyncEngine.fromOutbound(
                entry = store.get("msg-2"),
                lastAck = null,
                watchConnectedToPhone = false,
                nowMs = 2L,
            )
        assertEquals(WearUserFacingPhase.PHONE_UNREACHABLE, display.phase)
        assertFalse(display.showsFalseSuccess)
    }

    @Test
    fun phoneAck_marksQueuedWithoutServerClaim() {
        val wire =
            WearSosCreateWire(
                messageId = "msg-3",
                nonce = "nonce-3",
                sosType = "diğer",
                createdAtMs = 1L,
            )
        queue.enqueueOrGetExisting(wire, nowMs = 1L, phoneReachable = true)
        val updated =
            queue.applyPhoneAck(
                messageId = "msg-3",
                nonce = "nonce-3",
                ackStatus = WearPhoneAckStatus.QUEUED,
                outboxDigest = "digest-abc",
                nowMs = 5L,
            )
        assertNotNull(updated)
        assertEquals(WearOutboundWireStatus.PHONE_QUEUED, updated!!.status)
        val display =
            WearStateSyncEngine.fromOutbound(
                entry = updated,
                lastAck = null,
                watchConnectedToPhone = true,
                nowMs = 6L,
            )
        assertEquals(WearUserFacingPhase.PHONE_QUEUED, display.phase)
        assertFalse(display.showsFalseSuccess)
    }
}

class WearRetryPolicyTest {
    @Test
    fun backoff_increasesWithAttempts() {
        val first = WearRetryPolicy.nextRetryAtMs(attemptCount = 0, nowMs = 1000L)
        val second = WearRetryPolicy.nextRetryAtMs(attemptCount = 2, nowMs = 1000L)
        assertEquals(1000L + 5_000L, first)
        assertEquals(1000L + 60_000L, second)
    }
}
