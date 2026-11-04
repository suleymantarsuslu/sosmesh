package com.sosmesh.android.wear.ui

import com.sosmesh.android.core.wear.companion.queue.InMemoryWearOfflineQueueStore
import com.sosmesh.android.core.wear.companion.transport.WearCompanionTransport
import com.sosmesh.android.core.wear.companion.watch.WearSosCoordinator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class WearSosViewModelTwoStepTest {
    private val store = InMemoryWearOfflineQueueStore()
    private val transport = RecordingWearTransport(reachable = true)
    private val coordinator = WearSosCoordinator(store, transport)
    private val viewModel = WearSosViewModel(coordinator)

    @Test
    fun pressAndRelease_opensConfirm_withoutEnqueue() {
        viewModel.onSosPressStart()
        viewModel.onSosPressRelease()
        assertEquals(WearConfirmStep.CONFIRM_DIALOG, viewModel.confirmStep)
        assertNull(coordinator.latestEntry())
        assertEquals(0, transport.sendAttempts)
    }

    @Test
    fun cancel_afterConfirmDialog_doesNotEnqueue() {
        viewModel.onSosPressStart()
        viewModel.onSosPressRelease()
        viewModel.onConfirmCancel()
        assertEquals(WearConfirmStep.CANCELLED, viewModel.confirmStep)
        assertNull(coordinator.latestEntry())
        assertEquals(0, transport.sendAttempts)
    }

    @Test
    fun cancelAcknowledged_returnsToIdle() {
        viewModel.onSosPressStart()
        viewModel.onSosPressRelease()
        viewModel.onConfirmCancel()
        viewModel.onCancelAcknowledged()
        assertEquals(WearConfirmStep.IDLE, viewModel.confirmStep)
        assertNull(coordinator.latestEntry())
    }

    @Test
    fun confirmSend_enqueuesOnce() {
        viewModel.onSosPressStart()
        viewModel.onSosPressRelease()
        viewModel.onConfirmSend(nowMs = 42L)
        assertEquals(WearConfirmStep.IDLE, viewModel.confirmStep)
        assertNotNull(coordinator.latestEntry())
        assertEquals(1, store.listAll().size)
    }

    @Test
    fun shortTapOnly_armedButNoDialogIfReleaseWithoutFullPress() {
        viewModel.onSosPressStart()
        assertEquals(WearConfirmStep.FIRST_ARMED, viewModel.confirmStep)
        assertNull(coordinator.latestEntry())
    }

    private class RecordingWearTransport(
        private val reachable: Boolean,
    ) : WearCompanionTransport {
        var sendAttempts: Int = 0

        override fun isPhoneReachable(): Boolean = reachable

        override fun sendCreateToPhone(
            payload: ByteArray,
            onSuccess: () -> Unit,
            onFailure: (String) -> Unit,
        ) {
            sendAttempts += 1
            if (reachable) {
                onSuccess()
            } else {
                onFailure("phone_not_reachable")
            }
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
