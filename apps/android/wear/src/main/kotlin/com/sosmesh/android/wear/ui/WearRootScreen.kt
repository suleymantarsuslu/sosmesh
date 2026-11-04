package com.sosmesh.android.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import com.sosmesh.android.core.wear.companion.sync.WearUserFacingPhase
import kotlinx.coroutines.delay

@Composable
fun WearRootScreen(viewModel: WearSosViewModel) {
    LaunchedEffect(Unit) {
        while (true) {
            viewModel.refreshStatus()
            delay(2_000)
        }
    }
    val haptic = LocalHapticFeedback.current
    var resultVisible by remember { mutableStateOf(false) }
    val phase = viewModel.userFacingPhase

    WearSosTheme {
        Box(modifier = Modifier.fillMaxSize().background(WearSosPalette.Background)) {
            when {
                viewModel.confirmStep == WearConfirmStep.CONFIRM_DIALOG ->
                    WearConfirmScreen(
                        onSend = {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            viewModel.onConfirmSend()
                            resultVisible = true
                        },
                        onCancel = viewModel::onConfirmCancel,
                    )
                viewModel.confirmStep == WearConfirmStep.CANCELLED ->
                    WearCancelledScreen(onDone = viewModel::onCancelAcknowledged)
                resultVisible && phase != WearUserFacingPhase.IDLE ->
                    WearResultScreen(phase = phase, onDone = { resultVisible = false })
                else ->
                    WearHomeScreen(
                        phase = phase,
                        isAmbient = viewModel.isAmbientMode,
                        onHoldComplete = {
                            viewModel.onSosPressStart()
                            viewModel.onSosPressRelease()
                        },
                    )
            }
        }
    }
}
