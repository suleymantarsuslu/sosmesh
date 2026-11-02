package com.sosmesh.android.wear.ui

import com.sosmesh.android.core.wear.companion.queue.InMemoryWearOfflineQueueStore
import com.sosmesh.android.core.wear.companion.sync.WearUserFacingPhase
import com.sosmesh.android.core.wear.companion.transport.WearCompanionTransport
import com.sosmesh.android.core.wear.companion.watch.WearSosCoordinator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WearSosViewModelPhoneUnreachableTest {
    @Test
    fun whenPhoneUnreachable_showsExplicitCopy_notSentClaim() {
        val store = InMemoryWearOfflineQueueStore()
        val transport = UnreachableTransport()
        val coordinator = WearSosCoordinator(store, transport)
        val viewModel = WearSosViewModel(coordinator)

        viewModel.onSosPressStart()
        viewModel.onSosPressRelease()
        viewModel.onConfirmSend(nowMs = 100L)
        viewModel.refreshStatus(nowMs = 101L)

        assertEquals(WearUserFacingPhase.PHONE_UNREACHABLE, viewModel.userFacingPhase)
        assertFalse(viewModel.showsFalseSuccess)
        assertTrue(viewModel.statusDetail.contains("denmez"))
    }

    private class UnreachableTransport : WearCompanionTransport {
        override fun isPhoneReachable(): Boolean = false

        override fun sendCreateToPhone(
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            onFailure("phone_not_reachable")
        }

        override fun sendCreateToNode(
            nodeId: String,
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            sendCreateToPhone(payload, onSuccess, onFailure)
        }
    }
}
