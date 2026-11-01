package com.sosmesh.android.core.wear.companion.sync

import com.sosmesh.android.core.wear.companion.protocol.WearOutboundWireStatus
import com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckStatus
import com.sosmesh.android.core.wear.companion.protocol.WearPhoneAckWire
import com.sosmesh.android.core.wear.companion.protocol.WearSosCreateWire
import com.sosmesh.android.core.wear.companion.queue.WearOutboundEntry
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WearStateSyncEngineCopyTest {
    private val wire =
        WearSosCreateWire(
            messageId = "m1",
            nonce = "n1",
            sosType = "diğer",
            createdAtMs = 0L,
        )

    @Test
    fun allPhases_neverShowFalseSuccess() {
        val cases =
            listOf(
                WearStateSyncEngine.fromOutbound(null, null, true, 0L),
                WearStateSyncEngine.fromOutbound(
                    entry(wire, WearOutboundWireStatus.PHONE_UNREACHABLE),
                    null,
                    false,
                    1L,
                ),
                WearStateSyncEngine.fromOutbound(
                    entry(wire, WearOutboundWireStatus.AWAITING_PHONE),
                    null,
                    true,
                    1L,
                ),
                WearStateSyncEngine.fromOutbound(
                    entry(wire, WearOutboundWireStatus.PHONE_QUEUED),
                    null,
                    true,
                    1L,
                ),
            )
        for (state in cases) {
            assertFalse(
                "phase=${state.phase} must not show false success",
                state.showsFalseSuccess,
            )
        }
    }

    @Test
    fun phoneQueued_copyExplicitlyDeniesServerDelivery() {
        val state =
            WearStateSyncEngine.fromOutbound(
                entry(wire, WearOutboundWireStatus.PHONE_QUEUED),
                lastAck =
                    WearPhoneAckWire(
                        messageId = "m1",
                        nonce = "n1",
                        status = WearPhoneAckStatus.QUEUED,
                        outboxDigest = "d",
                        phoneNowMs = 1L,
                    ),
                watchConnectedToPhone = true,
                nowMs = 2L,
            )
        assertTrue(state.detailTr.contains("sunucuya ulaştı denmez"))
    }

    private fun entry(
        wire: WearSosCreateWire,
        status: String,
    ): WearOutboundEntry =
        WearOutboundEntry(
            messageId = wire.messageId,
            nonce = wire.nonce,
            wire = wire,
            status = status,
            attemptCount = 0,
            nextRetryAtMs = 0L,
            lastError = null,
            updatedAtMs = 0L,
        )
}
