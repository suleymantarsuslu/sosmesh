package com.sosmesh.android.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import kotlinx.coroutines.delay

@Composable
fun WearRootScreen(viewModel: WearSosViewModel) {
    LaunchedEffect(Unit) {
        while (true) {
            viewModel.refreshStatus()
            delay(2_000)
        }
    }

    when (viewModel.confirmStep) {
        WearConfirmStep.CONFIRM_DIALOG -> ConfirmDialog(viewModel)
        WearConfirmStep.CANCELLED -> StatusPanel(viewModel, accent = Color.DarkGray)
        else -> SosHome(viewModel, viewModel.isAmbientMode)
    }
}

@Composable
private fun SosHome(
    viewModel: WearSosViewModel,
    isAmbient: Boolean,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(8.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .background(WearAmbientUiPolicy.sosBackground(isAmbient))
                    .then(
                        if (isAmbient) {
                            Modifier
                        } else {
                            Modifier.pointerInput(Unit) {
                                detectTapGestures(
                                    onPress = {
                                        viewModel.onSosPressStart()
                                        tryAwaitRelease()
                                        viewModel.onSosPressRelease()
                                    },
                                )
                            }
                        },
                    )
                    .semantics { contentDescription = "SOS acil gönderim alanı" }
                    .testTag("wear_sos_touch_target"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "SOS",
                color = WearAmbientUiPolicy.primaryText(isAmbient),
                style = MaterialTheme.typography.title1,
            )
        }
        Text(
            text = viewModel.statusHeadline,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .padding(top = 8.dp)
                    .testTag("wear_status_headline"),
        )
        if (!WearAmbientUiPolicy.hideSecondaryDetailInAmbient(isAmbient)) {
            Text(
                text = viewModel.statusDetail,
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.caption1,
                modifier = Modifier.testTag("wear_status_detail"),
            )
        }
        Text(
            text = "112 yerine geçmez",
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.caption2,
            modifier =
                Modifier
                    .padding(top = 4.dp)
                    .testTag("wear_not112_disclaimer"),
        )
    }
}

@Composable
private fun ConfirmDialog(viewModel: WearSosViewModel) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(8.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "SOS gönder?", textAlign = TextAlign.Center)
        Button(onClick = { viewModel.onConfirmSend() }, modifier = Modifier.padding(top = 8.dp)) {
            Text("Gönder")
        }
        Button(onClick = { viewModel.onConfirmCancel() }, modifier = Modifier.padding(top = 4.dp)) {
            Text("İptal")
        }
    }
}

@Composable
private fun StatusPanel(
    viewModel: WearSosViewModel,
    accent: Color,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(accent)
                .padding(12.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = viewModel.statusHeadline, color = Color.White, textAlign = TextAlign.Center)
        Text(
            text = viewModel.statusDetail,
            color = Color.White,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}
