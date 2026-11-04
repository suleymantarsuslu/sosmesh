package com.sosmesh.android.wear.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.sosmesh.android.core.wear.companion.sync.WearUserFacingPhase
import com.sosmesh.android.core.wear.companion.watch.WearSosCoordinator

enum class WearConfirmStep {
    IDLE,
    FIRST_ARMED,
    CONFIRM_DIALOG,
    CANCELLED,
}

class WearSosViewModel(
    private val coordinator: WearSosCoordinator,
) : ViewModel() {
    var confirmStep by mutableStateOf(WearConfirmStep.IDLE)
        private set

    var statusHeadline by mutableStateOf("SOS")
        private set

    var statusDetail by mutableStateOf("Acil durumda iki adımda onaylayın.")
        private set

    var isAmbientMode by mutableStateOf(false)
        private set

    var userFacingPhase by mutableStateOf(WearUserFacingPhase.IDLE)
        private set

    var showsFalseSuccess by mutableStateOf(false)
        private set

    fun applyAmbientMode(enabled: Boolean) {
        isAmbientMode = enabled
    }

    fun onSosPressStart() {
        if (confirmStep == WearConfirmStep.IDLE) {
            confirmStep = WearConfirmStep.FIRST_ARMED
        }
    }

    fun onSosPressRelease() {
        if (confirmStep == WearConfirmStep.FIRST_ARMED) {
            confirmStep = WearConfirmStep.CONFIRM_DIALOG
        }
    }

    fun onConfirmCancel() {
        confirmStep = WearConfirmStep.CANCELLED
        statusHeadline = "SOS gönderilmedi"
        statusDetail = "İptal edildi."
    }

    /** Leaves the "not sent" screen and returns to the home state. */
    fun onCancelAcknowledged() {
        if (confirmStep == WearConfirmStep.CANCELLED) {
            confirmStep = WearConfirmStep.IDLE
            refreshStatus()
        }
    }

    fun onConfirmSend(nowMs: Long = System.currentTimeMillis()) {
        val wire = coordinator.buildCreateWire(nowMs)
        coordinator.submitConfirmed(wire, nowMs)
        refreshStatus(nowMs)
        confirmStep = WearConfirmStep.IDLE
    }

    fun refreshStatus(nowMs: Long = System.currentTimeMillis()) {
        val display = coordinator.displayState(nowMs)
        userFacingPhase = display.phase
        showsFalseSuccess = display.showsFalseSuccess
        statusHeadline = display.headlineTr
        statusDetail = display.detailTr
    }
}
